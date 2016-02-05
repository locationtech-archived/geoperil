package Tsunami;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

import com.mongodb.BasicDBObject;
import com.mongodb.DB;
import com.mongodb.DBObject;

import GeoHazardServices.EQTask;
import Misc.SshConnection;

public class EasyWaveAdapter extends TsunamiAdapter {

	public EasyWaveAdapter(DB db, SshConnection[] sshCon, File workdir, String hardware) throws IOException {
		super(db, sshCon, workdir, hardware);
		// TODO Auto-generated constructor stub
	}

	@Override
	protected void writeFault(EQTask task) throws IOException {
		// TODO Auto-generated method stub

	}

	@Override
	protected void writeLocations(EQTask task) throws IOException {
		StringBuilder strLocations = new StringBuilder();
		HashMap<String, DBObject> locations = getLocations();
		for(String id: locations.keySet()) {
			DBObject loc = locations.get(id);
			strLocations.append(id + "\t" + loc.get("lon") + "\t" + loc.get("lat") );
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
		ArrayList<Integer> statIds = new ArrayList<Integer>();
		lines = sshCon[0].readFile("eWave.poi.ssh");
		/* search for stations in headline and store related index */		
		for( int i = 0; i < lines.size(); i++ ) {
			String[] data = lines.get(i).trim().split( "\\s+" );
			if( i == 0 ) {
				for( int j = 1; j < data.length; j++ ) {
					String id = data[j];
					DBObject loc = locations.get(id);
					if( loc.get("type").equals("STATION") )
	    				statIds.add(j);
				}
				continue;
			}
			
			long rel_time = (long)(Float.valueOf(data[0]) * 60);
	    	if( rel_time > task.duration * 60 )
	    		break;
	    			    	
	    	/* extract value of each station for the next timestamp */
	    	for( int j = 0; j < statIds.size(); j++ ) {
	    		@SuppressWarnings("unchecked")
				List<DBObject> values = (List<DBObject>) locations.get( statIds.get(j) ).get("values");
	    		values.add(
	    			new BasicDBObject("reltime", rel_time).append("value", data[ statIds.get(j) ])
	    		);
	    	}
		}
		return 0;
	}

	@Override
	protected int simulate(EQTask task) throws IOException {
		// TODO Auto-generated method stub
		return 0;
	}
}
