package Tsunami;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;

import com.mongodb.BasicDBList;
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
	
	private HashMap<String, DBObject> locations;
	
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
			prepareLocations(task);
			writeLocations(task);
			simulate(task);
			/* Create tsunami jets. */
			for( Double ewh: GlobalParameter.jets.keySet() )
				createJets(task, ewh.toString());
			readLocations(task);
			finalizeLocations(task);
			updateProgress(task, true);
			finalize(task);
			cleanup(task);
			return 0;
		} catch(IOException e) {
			return -1;
		}
	}
	
	protected abstract void writeFault(EQTask task) throws IOException;
	protected abstract void writeLocations(EQTask task) throws IOException;
	protected abstract int simulate(EQTask task) throws IOException;
	protected abstract int readLocations(EQTask task) throws IOException;
	
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
			String.format("rm -f heights.*.kml fault.inp locations.inp eWave.2D.sshmax range.grd")
		);
	}
	
	protected HashMap<String, DBObject> getLocations() {
		return locations;
	}
	
	protected void prepareLocations(EQTask task) {
		locations = new HashMap<String, DBObject>();
		prepareTFPs(task, locations);
		prepareTSPs(task, locations);
		prepareStations(task, locations);
	}
	
	private void prepareTFPs(EQTask task, HashMap<String, DBObject> locations) {
		DBObject tfpQuery = null;
		if( task.user.inst != null ) {
			/* filter TFPs according to institution settings */
			DBObject instObj = db.getCollection("institutions").findOne(
				new BasicDBObject("name", task.user.inst)
			);
		
			if( instObj != null ) {
				@SuppressWarnings("unchecked")
				List<Object> tfpList = (List<Object>) instObj.get("tfps");
				if( tfpList != null ) {
					BasicDBList tfpOrList = new BasicDBList();
					for( Object s: tfpList ) {
						tfpOrList.add( new BasicDBObject("code", new BasicDBObject("$regex", s)) );
					}
					tfpQuery = new BasicDBObject("$or", tfpOrList);
				}
			}
		}
						
		for( DBObject obj: db.getCollection("tfps").find( tfpQuery ) ) {
			String id = (String) obj.get( "_id" ).toString();
			DBObject init = new BasicDBObject();
			init.put( "lat", obj.get( "lat_sea" ) );
			init.put( "lon", obj.get( "lon_sea" ) );
			init.put( "ewh", 0.0 );
			init.put( "eta", -1.0 );
			init.put( "tfp", id );
			init.put( "EventID", task.id );
			init.put( "type", "TFP" );
			locations.put( id, init );
		}
	}
	
	private void prepareTSPs(EQTask task, HashMap<String, DBObject> locations) {
		for( DBObject obj: db.getCollection("tsps").find() ) {
			String id = (String) obj.get( "_id" ).toString();			
			DBObject init = new BasicDBObject();
			init.put( "lat", obj.get( "lat_sea" ) );
			init.put( "lon", obj.get( "lon_sea" ) );
			init.put( "ewh", 0.0 );
			init.put( "eta", -1.0 );
			init.put( "tsp", id );
			init.put( "EventID", task.id );
			init.put( "cfcz", obj.get( "FID_IO_DIS" ) );
			init.put( "type", "TSP" );
			locations.put( id, init );
		}
	}
	
	private void prepareStations(EQTask task, HashMap<String, DBObject> locations) {
		BasicDBList andList = new BasicDBList();
		/* check if a real user requests this computation */
		DBObject userObj = db.getCollection("users").findOne(
			new BasicDBObject("_id", task.user.objId )
		);
		if( userObj != null ) {
			BasicDBList ccodes = (BasicDBList) userObj.get("countries");
			/* if no country specified, set to an empty list */
			if( ccodes == null )
				ccodes = new BasicDBList();
			andList.add(
				new BasicDBObject("country", new BasicDBObject("$in", ccodes) )
			);			
		}
		
		String inst = task.user.inst;
		if( inst == null || inst.equals("gfz") || inst.equals("tdss15") )
			inst = "gfz_ex_test";
		andList.add( new BasicDBObject( "inst", inst ) );
				
		for( DBObject obj: db.getCollection("stations").find( new BasicDBObject("$and", andList) )) {
			String id = (String) obj.get( "name" );		
			DBObject init = new BasicDBObject();
			init.put( "lat", obj.get( "lat" ) );
			init.put( "lon", obj.get( "lon" ) );
			init.put( "values", new ArrayList<DBObject>() );
			init.put( "type", "STATION" );
			locations.put( id, init );
		}
	}
	
	protected void finalizeLocations(EQTask task) {
		
		HashMap<Integer,Double> maxEWH = new HashMap<Integer, Double>();
	    HashMap<Integer,Double> minETA = new HashMap<Integer, Double>();
	    /* translate date into time stamp */
		long time = task.eqparams.date.getTime() / 1000;
		for(String id: locations.keySet() ) {
			DBObject loc = locations.get(id);
			if( loc.get("type").equals("TFP") || loc.get("type").equals("TSP") ) {
				loc.removeField("lat");
				loc.removeField("lon");
				db.getCollection("comp").insert(loc);	
				
			} else if( loc.get("type").equals("STATION") ) {
				@SuppressWarnings("unchecked")
				List<DBObject> values = (List<DBObject>) loc.get("values");
				for(DBObject obj: values) {
					long rel_time = (long) obj.get("reltime") / task.accel;
					obj.put("inst", task.user.inst);
					obj.put("timestamp", time + rel_time);
					obj.put("reltime", rel_time);
					obj.put("station", id);
					obj.put("evid", task.id);
				}
				db.getCollection("simsealeveldata").insert(values);
			}
			
			/* Update maximal and minimal CFZ values. */
			if( loc.get("type").equals("TSP") ) {
			    Double ewh = (Double) loc.get("ewh");
		    	Double eta = (Double) loc.get("eta");
		    	Integer cfz = (Integer) loc.get("cfcz");
		    
		    	if( ! maxEWH.containsKey(cfz) ) {
		    		maxEWH.put(cfz, ewh);
		    		minETA.put(cfz, eta);
		    	}
		    	maxEWH.put(cfz, Math.max( maxEWH.get(cfz), ewh ) );
		    	minETA.put(cfz, Math.min( minETA.get(cfz), eta ) );
			}
		}
		/* Insert CFZ values into database. */
		for(Integer key: maxEWH.keySet() ) {
	    	DBObject cfz = new BasicDBObject();
	    	cfz.put("code", key);
	    	cfz.put("type", "CFZ");
	    	cfz.put("ewh", maxEWH.get(key));
	    	cfz.put("eta", minETA.get(key));
	    	cfz.put("EventID", task.id);
	    	db.getCollection("comp").insert( cfz );
	    }
	}
}
