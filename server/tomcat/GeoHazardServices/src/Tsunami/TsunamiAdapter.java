package Tsunami;

import java.io.File;
import java.io.IOException;
import java.util.Date;

import com.mongodb.BasicDBObject;
import com.mongodb.DB;
import com.mongodb.DBObject;
import com.mongodb.util.JSON;

import GeoHazardServices.EQTask;
import GeoHazardServices.GlobalParameter;
import GeoHazardServices.IAdapter;
import GeoHazardServices.Task;
import Misc.LocalConnection;
import Misc.SshConnection;

public abstract class TsunamiAdapter implements IAdapter {

	protected SshConnection[] sshCon;
	protected DB db;
	protected File workdir;
	protected String hardware;
	protected LocalConnection localCon;
	
	public TsunamiAdapter(DB db, SshConnection[] sshCon, File workdir, String hardware) throws IOException {
		this.db = db;
		this.sshCon = sshCon;
		this.workdir = workdir;
		this.hardware = hardware;
		this.localCon = new LocalConnection(workdir.getAbsolutePath());
	}
	
	@Override
	public int handleRequest(Task task) {
		if( task instanceof EQTask )
			return handleRequest( (EQTask)task );
		throw new IllegalArgumentException("TsunamiAdapter requires EQTask.");
	}
	
	public int handleRequest(EQTask task) {
		System.out.println("TsuamiAdapter: " + task);
		try {
			writeFault(task);
			writeTFPs(task);
			simulate(task);
			/* Create tsunami jets. */
			for( Double ewh: GlobalParameter.jets.keySet() )
				createJets(task, ewh.toString());
			updateProgress(task, true);
			finalize(task);
			cleanup(task);
			return 0;
		} catch(IOException e) {
			return -1;
		}
	}
	
	protected abstract void writeFault(EQTask task) throws IOException;
	protected abstract void writeTFPs(EQTask task) throws IOException;
	protected abstract int simulate(EQTask task) throws IOException;
	
	/* Should be called by child classes if progress of simulation has changed. */
	protected int updateProgress(EQTask task) {
		return updateProgress(task, false);
	}
	
	private int updateProgress(EQTask task, boolean finalize) {
		/*  */
		if( task.progress == 100.0f && ! finalize )
			return 0;
		
		/* DB object to find current earthquake ID */
		BasicDBObject obj = new BasicDBObject("_id", task.id );
		
		/* create sub-object that is used to update the current progress */
		BasicDBObject setter = new BasicDBObject("raw_progress",  task.progress);
		if( task.raw == 0 ) {
			setter.put( "process." + 0 + ".progress", task.progress );
			setter.put( "process." + 0 + ".curSimTime", /* TODO */ 0 );
			setter.put( "process." + 0 + ".calcTime", task.calcTime );
		}
		
		/* build update query */
		BasicDBObject update = new BasicDBObject( "$set", setter );
		/* update the DB entry with the given ID*/
		db.getCollection("eqs").update( obj, update );
		
		if( task.raw == 0 ) {
			/* create DB object that holds all event data */
			BasicDBObject event = new BasicDBObject();
			event.append( "id", task.id );
			event.append( "user", task.user.objId );
			event.append( "timestamp", new Date() );
			event.append( "event", "progress" );
			event.append( "progress", task.progress );
								
			/* create reference event that should be updated */
			BasicDBObject refEvent = new BasicDBObject("id", task.id );
			refEvent.put( "event", "progress" );
			
			/* update the reference event with the new data */
			db.getCollection("events").update( refEvent, event, true, false );
		}
		return 0;
	}
	
	/* Should be called by child classes if the computation was successfully started. */
	protected int initialProgress(EQTask task) {
			/* DB object to find current earthquake ID */
			BasicDBObject obj = new BasicDBObject("_id", task.id );
			
			/* create sub-object that holds all event data */
			BasicDBObject dbObject = new BasicDBObject();
			dbObject.put( "progress", 0.0 );
			if( task.bbox != null )
				dbObject.put( "grid_dim", (BasicDBObject) JSON.parse("{ lonMin: " + task.bbox.lonMin + ", lonMax: " + task.bbox.lonMax + ", latMin: " + task.bbox.latMin + ", latMax: " + task.bbox.latMax + " }" ) );
			dbObject.put( "resolution", task.gridres / 60.0 );
			dbObject.put( "simTime", task.duration );
			dbObject.put( "curSimTime", 0.0 );
			dbObject.put( "calcTime", 0.0 );
			dbObject.put( "resources", this.hardware );
			
			/* create final DB object used to update the collection  */
			BasicDBObject update = new BasicDBObject();
			update.put( "$push", new BasicDBObject( "process", dbObject ) );
			
			/* append a new process entry and return the corresponding index */
			db.getCollection("eqs").findAndModify( obj, null, null, false, update, true, false);
			return 0;
	}
	
	protected int createJets(EQTask task, String ewh) throws IOException {
		
		/* Nothing to do if a raw computation was requested. */
		if( task.raw > 0 )
			return 0;

		String kml_file = String.format("heights.%s.kml", ewh);
		
		/* ssh should be okay upon here, therefore run commands */
		sshCon[0].runCmds(
			String.format("gdal_contour -f kml -fl %1$s eWave.2D.sshmax heights.%1$s.kml", ewh),
			String.format("ogr2ogr -f kml -simplify 0.001 heights.%1$s.kml heights.%1$s.kml", ewh)
		);		
		sshCon[0].copyFile(kml_file, workdir + "/" + kml_file);
			
		localCon.runCmd( String.format("python ../getEWH.py heights.%1$s.kml %1$s %2$s", ewh, task.id) );
		return 0;
	}
	
	protected void saveRawData(EQTask task) throws IOException {
		DBObject dirs = db.getCollection("settings").findOne(new BasicDBObject("type", "dirs"));
		String resdir = (String) dirs.get("results") + "/events/" + task.id;
		localCon.runCmds(
			String.format("mkdir -p -m 0777 %s", resdir),
			String.format("rm -f %s/*", resdir),
			String.format("chmod 0666 %s/*", resdir)
		);
		String files[] = {"eWave.2D.sshmax"};
		for(String f: files) {
			sshCon[0].copyFile(f, resdir + "/" + f);
		}
		/* Data was successfully stored --> mark event in database. */
		db.getCollection("eqs").update(
			new BasicDBObject("_id", task.id ),
			new BasicDBObject("$set", new BasicDBObject("stored", true))
		);
	}
	
	protected void finalize(EQTask task) throws IOException {
		if( task.evtset == null ) {
			saveRawData(task);
		}
	}
	
	protected void cleanup(EQTask task) throws IOException {
		sshCon[0].runCmd(
			String.format("rm -f heights.*.kml fault.inp eWave.2D.sshmax range.grd")
		);
	}
}
