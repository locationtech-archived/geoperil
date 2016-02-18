package Tsunami;

import java.io.File;
import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.mongodb.BasicDBObject;
import com.mongodb.DB;
import com.mongodb.DBObject;

import GeoHazardServices.EQParameter;
import GeoHazardServices.EQTask;
import Misc.BetterStringBuilder;
import Misc.SshConnection;

public class EasyWaveAdapter extends TsunamiAdapter {

	public EasyWaveAdapter(DB db, SshConnection[] sshCon, File workdir, String hardware, String args) throws IOException {
		super(db, sshCon, workdir, hardware, args);
	}

	@Override
	protected void writeFault(EQTask task) throws IOException {
		EQParameter eqp = task.eqparams;
		BetterStringBuilder strFault = new BetterStringBuilder();
		strFault.appendManyNl(
			eqp.mw != 0
				? "-mw " + eqp.mw
				: String.format("-slip %f -size %f %f", eqp.slip, eqp.length, eqp.width),
			String.format(" -location %f %f %f -strike %f -dip %f -rake %f",
				eqp.lon, eqp.lat, eqp.depth, eqp.strike, eqp.dip, eqp.rake
			)
		);
		sshCon[0].writeFile(strFault.toString(), "fault.inp");
	}

	@Override
	protected void writeLocations(EQTask task) throws IOException {
		BetterStringBuilder strLocations = new BetterStringBuilder();
		HashMap<String, DBObject> locations = getLocations();
		for(String id: locations.keySet()) {
			DBObject loc = locations.get(id);
			strLocations.appendln(id + "\t" + loc.get("lon") + "\t" + loc.get("lat") );
		}
		sshCon[0].writeFile(strLocations.toString(), "locations.inp");
	}
	
	@Override
	protected int readLocations(EQTask task) throws IOException {
		if( task.raw > 0 )
			return 0;
				
		HashMap<String, DBObject> locations = getLocations();
		/* Read TFPs and TSPs from file. */
		List<String> lines = sshCon[0].readFile("eWave.poi.summary");
		/* skip headline */
		for( int i = 1; i < lines.size(); i++ ) {
			String[] data = lines.get(i).split( "\\s+" );
			String id = data[0];
			DBObject loc = locations.get(id);
			if( loc.get("type").equals("TFP") || loc.get("type").equals("TSP") ) {
				loc.put( "eta", Double.valueOf( data[1] ) );
				loc.put( "ewh", Double.valueOf( data[2] ) );
			}
		}
		
		/* Read stations from file. */
		Map<Integer, String> statIds = new HashMap<Integer, String>();
		lines = sshCon[0].readFile("eWave.poi.ssh");
		/* search for stations in headline and store related index */		
		for( int i = 0; i < lines.size(); i++ ) {
			String[] data = lines.get(i).trim().split( "\\s+" );
			if( i == 0 ) {
				for( int j = 1; j < data.length; j++ ) {
					String id = data[j];
					DBObject loc = locations.get(id);
					if( loc.get("type").equals("STATION") )
	    				statIds.put(j, id);
				}
				continue;
			}
			
			long rel_time = (long)(Float.valueOf(data[0]) * 60);
	    	if( rel_time > task.duration * 60 )
	    		break;
	    			    	
	    	/* extract value of each station for the next timestamp */
	    	for(Integer j: statIds.keySet()) {
	    		@SuppressWarnings("unchecked")
				List<DBObject> values = (List<DBObject>) locations.get( statIds.get(j) ).get("values");
	    		values.add(
	    			new BasicDBObject("reltime", rel_time).append("value", data[j])
	    		);
	    	}
		}
		return 0;
	}

	@Override
	protected int simulate(EQTask task) throws IOException {
		int simTime = task.duration + 10;
		String cmdParams = String.format(
			"-grid ../grid_%d.grd -poi locations.inp -poi_dt_out 30 -poi_search_dist 20 -source fault.inp -propagation %d -step 1 -ssh_arrival 0.001 -time %d -verbose -adjust_ztop %s",
			task.gridres, task.dt_out, simTime, args
		);
		String line;
		task.curSimTime = 0.0f;
		task.calcTime = 0.0f;
		sshCon[0].runLiveCmd("easywave " + cmdParams);
		while( (line = sshCon[0].nextLine()) != null) {
			Matcher matcher = Pattern.compile("range: (.*) (.*) (.*) (.*)").matcher(line);
			if( matcher.find() ) {
				/* get region boundaries */
				double lonMin = Double.valueOf( matcher.group(1) );
				double lonMax = Double.valueOf( matcher.group(2) );
				double latMin = Double.valueOf( matcher.group(3) );
				double latMax = Double.valueOf( matcher.group(4) );
				task.setBoundingBox(lonMin, lonMax, latMin, latMax);
				initialProgress(task);
				continue;
			}
			/* check if output line contains progress report */
			matcher = Pattern.compile("(\\d\\d):(\\d\\d):(\\d\\d).*elapsed: (\\d*) msec").matcher(line);
			if( ! matcher.find() ) continue;
			System.out.println( matcher.group() );
			/* parse current simulation time */
			int hours = Integer.valueOf( matcher.group(1) );
			int min = Integer.valueOf( matcher.group(2) );
			int totalMin = hours * 60 + min;
			
			/* calculate current progress in percentage */
			task.progress = ( (float)totalMin / (float)simTime ) * 100.0f;
			task.prevSimTime = task.curSimTime;
			task.curSimTime = totalMin;
			task.prevCalcTime = task.calcTime;
			task.calcTime = Integer.valueOf( matcher.group(4) );
			
			updateProgress(task);
		}
		return 0;
	}
}
