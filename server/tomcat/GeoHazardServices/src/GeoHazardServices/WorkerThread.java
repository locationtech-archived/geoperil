package GeoHazardServices;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.File;
import java.io.FileOutputStream;
import java.io.FileReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.PrintStream;
import java.io.Writer;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.concurrent.PriorityBlockingQueue;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.mongodb.BasicDBList;
import com.mongodb.BasicDBObject;
import com.mongodb.DBCollection;
import com.mongodb.DBCursor;
import com.mongodb.DBObject;
import com.mongodb.MongoClient;
import com.mongodb.WriteConcern;
import com.mongodb.util.JSON;

public class WorkerThread implements Runnable, Comparable<WorkerThread> {

	private PriorityBlockingQueue<WorkerThread> workerQueue;
	private File workdir;
	
	private boolean remote;
	private SshConnection[] sshCon;
	
	private Thread thread;
	private MongoClient dbclient;
	
	private String hardware;
	
	private Integer priority;
	private Object lock;
	private TaskParameter task;
	
	private HashMap<String, DBObject> tfps;
	private HashMap<String, DBObject> tsps;
	
	public WorkerThread( PriorityBlockingQueue<WorkerThread> queue,
						 String workdir ) throws IOException {
		
		this.workerQueue = queue;
		this.lock = new Object();
		this.priority = new Integer( 0 );
		
		this.workdir = new File( workdir );
		
		if( this.workdir.mkdir() == false ) {
			throw new IOException( "Could not create working directory!" );
		}
				
		try {
			this.dbclient = new MongoClient();
		} catch (UnknownHostException e) {
			e.printStackTrace();
		}
	}
		
	public int setRemote( String user, String host, String dir ) {
		
		this.remote = true;
		
		sshCon = new SshConnection[2];
				
		for( int i = 0; i < 2; i++ ) {
			
			try {
				sshCon[i] = new SshConnection(user, host, dir);
			} catch (IOException e) {
				e.printStackTrace();
				return 1;
			}
		}
		
		return 0;
	}
	
	public void setHardware( String hardware ) {
		this.hardware = hardware;
	}
	
	public void setPriority( int priority ) {
		this.priority = priority;
	}
		
	public void start() {
		thread = new Thread( this );
		thread.start();		
	}
	
	public void stop() {
		
		thread.interrupt();
		
		try {
			thread.join();
		} catch (InterruptedException e) {
			e.printStackTrace();
		}
		
		dbclient.close();
		
		for( int i = 0; i < 2; i++ ) {
			sshCon[i].close();
		}
		
		for( File f: workdir.listFiles() ) {
			f.delete();
		}
		
		workdir.delete();
	}
		
	@Override
	public void run() {
		
		TaskParameter params;
		
		System.out.println("Thread " + this.thread.getId() + " started");
		
		while( true ) {
		
			try {
				params = getWork();
				handleRequest( params );
								
			} catch (InterruptedException e) {
				break;
			}
		}
		
	}
	
	private int handleRequest( TaskParameter task ) {
				
		task.status = TaskParameter.STATUS_RUN;
		
		checkSshConnection();
		
		writeFault( task.eqparams );
		
		writeTFPs( task );
		
		if( startEasyWave( task ) != 0 ) {
			task.status = TaskParameter.STATUS_ERROR;
			return 0;
		}
								
		saveRawData( task );
		task.status = TaskParameter.STATUS_DONE;
		
		return 0;
	}
	
	private int checkSshConnection() {
		
		if( remote ) {
			
			/* check if ssh connection is still established */
			sshCon[0].out.println( "echo '\n'" );
			sshCon[0].out.flush();
			
			try {
							
				if( sshCon[0].in.readLine() == null ) {
				
					System.err.println( "Error: ssh connection was closed. Trying to reconnect..." );
					sshCon[0].connect();
					sshCon[1].connect();
				}
				
			} catch (IOException e) {
				e.printStackTrace();
				return 1;
			}
			
		}
		
		return 0;
	}
	
	private int writeFault( EQParameter eqp ) {
		
		String fault;
		
		if( eqp.mw != 0 ) {
			fault =	"-mw " + eqp.mw;
		} else {
			fault =	String.format("-slip %s -size %s %s", eqp.slip, eqp.length, eqp.width);
		}
		
		fault += " -location " + eqp.lon + " " + eqp.lat + " " + eqp.depth +
				 " -strike " + eqp.strike +
				 " -dip " + eqp.dip +
				 " -rake " + eqp.rake;
	
		if( remote ) {
			
			sshCon[0].out.println("echo '" + fault + "' > fault.inp");
			sshCon[0].out.flush();
			return 0;
			
		} else {
		
			Writer writer = null;
						
			try {
			    writer = new BufferedWriter(new OutputStreamWriter( new FileOutputStream( workdir.getAbsolutePath() + "/fault.inp") ) );
			    writer.write( fault );
			    writer.write("\n");
			    writer.close();
			    
			} catch (IOException ex) {
				System.err.println("Could not write fault!");
				return 1;
			}
		
		}
		
		return 0;
	}
	
	private int writeTFPs( TaskParameter task ) {
		
		if( ! remote )
			return 1;
		
		tfps = new HashMap<String, DBObject>();
		tsps = new HashMap<String, DBObject>();
		
		DBObject tfpQuery = null;
		DBCursor cursor;
		
		if( task.user.inst != null ) {
			
			/* filter TFPs according to institution settings */
			DBObject instQuery = new BasicDBObject( "name", task.user.inst );
			cursor = dbclient.getDB( "easywave" ).getCollection("institutions").find( instQuery );
		
			if( cursor.hasNext() ) {
				
				DBObject instObj = cursor.next();
				@SuppressWarnings("unchecked")
				List<Object> tfpList = (List<Object>) instObj.get("tfps");
				
				if( tfpList != null ) {
					
					BasicDBList tfpOrList = new BasicDBList();
					for( Object s: tfpList ) {
						tfpOrList.add( new BasicDBObject("code", new BasicDBObject( "$regex", s )) );
					}
					
					tfpQuery = new BasicDBObject( "$or", tfpOrList );
				}
				
			}
			cursor.close();
		}
		
		cursor = dbclient.getDB( "easywave" ).getCollection("tfps").find( tfpQuery );
		
		sshCon[0].out.println("rm ftps.inp");
				
		for( DBObject obj: cursor ) {
			
			String id = (String) obj.get( "_id" ).toString();
			Double lat = (Double) obj.get( "lat_sea" );
			Double lon = (Double) obj.get( "lon_sea" );
			
			DBObject init = new BasicDBObject();
			init.put( "ewh", 0.0f );
			init.put( "eta", -1.0f );
			init.put( "tfp", id );
			init.put( "EventID", task.id );
			
			tfps.put( id, init );
			
			String poi = id + "\t" + lon + "\t" + lat;
			sshCon[0].out.println("echo '" + poi + "' >> ftps.inp");
		}
		cursor.close();
		
		/* process TSPs */
		cursor = dbclient.getDB( "easywave" ).getCollection("tsps").find();
		for( DBObject obj: cursor ) {
			String id = (String) obj.get( "_id" ).toString();
			Double lat = (Double) obj.get( "lat_sea" );
			Double lon = (Double) obj.get( "lon_sea" );
			Number cfcz = (Number) obj.get( "FID_IO_DIS" );
			
			DBObject init = new BasicDBObject();
			init.put( "ewh", 0.0 );
			init.put( "eta", -1.0 );
			init.put( "tsp", id );
			init.put( "EventID", task.id );
			init.put( "cfcz", cfcz );
			tsps.put( "tsp_" + id, init );
			
			String poi = "tsp_" + id + "\t" + lon + "\t" + lat;
			sshCon[0].out.println("echo '" + poi + "' >> ftps.inp");
		}
		cursor.close();
		
		/* process stations */
		DBObject userObj = new BasicDBObject("_id", task.user.objId );
		BasicDBList ccodes = null;
		DBObject filter = null;
		DBObject query = null;
		BasicDBList andList = new BasicDBList();
		
		cursor = dbclient.getDB( "easywave" ).getCollection("users").find( userObj );
		/* check if a real user requests this computation */
		if( cursor.hasNext() ) {
			
			DBObject obj = cursor.next();
			ccodes = (BasicDBList) obj.get("countries");
			/* if no country specified, set to an empty list */
			if( ccodes == null )
				ccodes = new BasicDBList();
			
			filter = new BasicDBObject( "$in", ccodes );
			andList.add( new BasicDBObject( "country", filter ) );
			
		}
		
		cursor.close();
		
		String inst = task.user.inst;
		
		if( inst == null || inst.equals("gfz") || inst.equals("tdss15") )
			inst = "gfz_ex_test";
			
		andList.add( new BasicDBObject( "inst", inst ) );
		
		query = new BasicDBObject( "$and", andList );
				
		if( query != null ) {
			cursor = dbclient.getDB( "easywave" ).getCollection("stations").find( query );
		}
						
		for( DBObject obj: cursor ) {
			
			String id = (String) obj.get( "name" );
			Double lat = (Double) obj.get( "lat" );
			Double lon = (Double) obj.get( "lon" );
			
			String poi = "s_" + id + "\t" + lon + "\t" + lat;
			sshCon[0].out.println("echo '" + poi + "' >> ftps.inp");
		}
		
		sshCon[0].out.flush();
		
		cursor.close();
		
		return 0;
	}
	
	private int startEasyWave( TaskParameter task ) {
								
		Process p = null;
		int simTime = task.duration + 10;
		
		String cmdParams = " -grid ../grid_" + task.gridres + ".grd -poi ftps.inp -poi_dt_out 30 -source fault.inp -propagation " + task.dt_out + " -step 1 -ssh_arrival 0.001 -time " + simTime + " -verbose -adjust_ztop -gpu";
			
		System.out.println( "Thread " + this.thread.getId() + " processes the request." );
				
		try {
			
			BufferedReader reader = null;
			
			if( remote ) {
								
				sshCon[0].out.println( "rm eWave.* arrival.* easywave.log error.msg" );
				sshCon[0].out.println( "easywave " + cmdParams );
				sshCon[0].out.println( "echo '\004'" );
				sshCon[0].out.flush();
				
				reader = sshCon[0].in;
								
			} else {
				
				p = Runtime.getRuntime().exec( GlobalParameter.map.get("easywave") + cmdParams, null, workdir );
				reader = new BufferedReader(new InputStreamReader( p.getInputStream() ) );
		  
			}
			
			DBCollection coll = dbclient.getDB( "easywave" ).getCollection("eqs");
			DBCollection colEvents = dbclient.getDB( "easywave" ).getCollection("events");
						
			int processIndex = -1;
			
			String line = reader.readLine();			
			while (line != null && ! line.equals("\004")) {
								
				/* check if output line contains progress report */
				Matcher matcher = Pattern.compile( "(\\d\\d):(\\d\\d):(\\d\\d).*elapsed: (\\d*) msec" ).matcher( line );

				if( matcher.find() ) {
					
					/* parse current simulation time */
					int hours = Integer.valueOf( matcher.group(1) );
					int min = Integer.valueOf( matcher.group(2) );
					int calcTime = Integer.valueOf( matcher.group(4) );
					int totalMin = hours * 60 + min;
					
					System.out.println( matcher.group() );
					
					/* calculate current progress in percentage */
					task.progress = ( (float)totalMin / (float)simTime ) * 100.0f;
					
					/* create a kml file if at least 10 minutes of simulation are done */
					if( totalMin > 10 )
						createVectorFile( totalMin, task.id );
							
					if( task.progress == 100.0f ) {
						for( Double ewh: GlobalParameter.jets.keySet() )
							getWaveHeights( task.id, ewh.toString() );
					
						addPoiResults( task.id );
						addStationResults( task );
					}
					
					/* check if a new process entry was inserted previously - return otherwise */
					if( processIndex < 0 && task.raw == 0 ) {
						System.err.println( "Error: Invalid index into process array!" );
						return 1;
					}
						
					/* DB object to find current earthquake ID */
					BasicDBObject obj = new BasicDBObject("_id", task.id );
					
					/* create sub-object that is used to update the current progress */
					BasicDBObject setter = new BasicDBObject("raw_progress",  task.progress);
					if( task.raw == 0 ) {
						setter.put( "process." + processIndex + ".progress", task.progress );
						setter.put( "process." + processIndex + ".curSimTime", totalMin );
						setter.put( "process." + processIndex + ".calcTime", calcTime );
					}
					
					/* build update query */
					BasicDBObject update = new BasicDBObject( "$set", setter );
					
					/* update the DB entry with the given ID*/
					coll.update( obj, update );
												
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
						colEvents.update( refEvent, event, true, false );
					}
					
					if( task.progress == 100.0f && task.raw == 0 ) {
						pyPostProcess( task );
					}
					
				} else {
					
					/* this is the first time after simulation start - insert process entry */
					matcher = Pattern.compile( "range: (.*) (.*) (.*) (.*)" ).matcher( line );
					if( matcher.find() && task.raw == 0 ) {
						
						/* get region boundaries */
						double lonMin = Double.valueOf( matcher.group(1) );
						double lonMax = Double.valueOf( matcher.group(2) );
						double latMin = Double.valueOf( matcher.group(3) );
						double latMax = Double.valueOf( matcher.group(4) );
												
						/* DB object to find current earthquake ID */
						BasicDBObject obj = new BasicDBObject("_id", task.id );
						
						/* create sub-object that holds all event data */
						BasicDBObject dbObject = new BasicDBObject();
						dbObject.put( "progress", 0.0 );
						dbObject.put( "grid_dim", (BasicDBObject) JSON.parse("{ lonMin: " + lonMin + ", lonMax: " + lonMax + ", latMin: " + latMin + ", latMax: " + latMax + " }" ) );
						dbObject.put( "resolution", task.gridres / 60.0 );
						dbObject.put( "simTime", task.duration );
						dbObject.put( "curSimTime", 0.0 );
						dbObject.put( "calcTime", 0.0 );
						dbObject.put( "resources", this.hardware );
						
						/* create final DB object used tp update the collection  */
						BasicDBObject update = new BasicDBObject();
						update.put( "$push", new BasicDBObject( "process", dbObject ) );
						
						/* append a new process entry and return the corresponding index */
						DBObject ret = coll.findAndModify( obj, null, null, false, update, true, false);
						BasicDBList l = (BasicDBList) ret.get("process");
						processIndex = l.size() - 1;
					}
				}
				
				line = reader.readLine();
			}
			
			if( remote ) {
				System.out.println( "finished" );
			} else {
				p.waitFor();
			}
	  
		} catch (IOException | InterruptedException e) {
			e.printStackTrace();
			return 1;
		}
		
		if( ! remote ) {
			return p.exitValue();
		}
		
		return 0;
	}
	
	private int createVectorFile( int time, String id ) {
		
		/* Nothing to do if a raw computation was requested. */
		if( task.raw > 0 )
			return 0;
		
		Process p;
				
		/* TODO: adapt EasyWave to really get arrivals for the specific time and not for time - 1 */
		String gdal = String.format( "gdal_contour -f kml -i 10 -fl %d eWave.2D.%05d.time arrival.%d.kml",
									  time - 10, time * 60, time - 10);
		
		String ogr2ogr = String.format( "ogr2ogr -f kml -simplify 0.001 arrival.%d.kml arrival.%d.kml", time - 10, time - 10);
		
		String kml_parser = String.format( "python ../getShape.py arrival.%d.kml %d %s", time - 10, time - 10, id );
		
		String kml_file = String.format( "arrival.%d.kml", time - 10 );
		
		try {
						
			BufferedReader reader = null;
			
			if( remote ) {
					
				/* ssh should be okay upon here, therefore run commands */
				sshCon[1].out.println( gdal );
				sshCon[1].out.println( ogr2ogr );
				sshCon[1].out.println( "echo '\004'" );
				sshCon[1].out.flush();
						
				reader = sshCon[1].in;
				
			} else {
				p = Runtime.getRuntime().exec( gdal, null, workdir );
				p.waitFor();
				
				reader = new BufferedReader(new InputStreamReader( p.getInputStream() ) );
			}
	  		  
			String line = reader.readLine();			
			while (line != null && ! line.equals("\004")) {
				line = reader.readLine();
			}
			
			if( remote ) {
				sshCon[1].out.println( "cat " + kml_file );
				sshCon[1].out.println( "echo -n '\004'" );
				sshCon[1].out.flush();
				
				Writer writer = new BufferedWriter(new OutputStreamWriter( new FileOutputStream( workdir + "/" + kml_file ) ) );
				int ret = sshCon[1].in.read( sshCon[1].buffer, 0, sshCon[1].buffer.length );
				while( ret > 0 ) {
					if( sshCon[1].buffer[ ret - 1 ] == '\004' ) {
						ret -= 1;
						writer.write( sshCon[1].buffer, 0, ret );
						break;
					}
					writer.write( sshCon[1].buffer, 0, ret );
					ret = sshCon[1].in.read( sshCon[1].buffer, 0, sshCon[1].buffer.length );
				}
				writer.close();
			}
			
			p = Runtime.getRuntime().exec( kml_parser, null, workdir );
			p.waitFor();
			
			reader = new BufferedReader(new InputStreamReader( p.getInputStream() ) );
			  
			line = reader.readLine();
			while (line != null) {
				line = reader.readLine();
			}
				  
		} catch (IOException | InterruptedException e) {
			e.printStackTrace();
			return 1;
		}		
		
		return 0;
	}
	
	private int getWaveHeights( String id, String ewh ) {
		
		/* Nothing to do if a raw computation was requested. */
		if( task.raw > 0 )
			return 0;
		
		Process p;
				
		String gdal = String.format( "gdal_contour -f kml -fl %s eWave.2D.sshmax heights.%s.kml", ewh, ewh);
		
		String ogr2ogr = String.format( "ogr2ogr -f kml -simplify 0.001 heights.%s.kml heights.%s.kml", ewh, ewh);
		
		String kml_parser = String.format( "python ../getEWH.py heights.%s.kml %s %s", ewh, ewh, id );
		
		String kml_file = String.format( "heights.%s.kml", ewh );
		
		try {
						
			BufferedReader reader = null;
			
			if( remote ) {
					
				/* ssh should be okay upon here, therefore run commands */
				sshCon[1].out.println( gdal );
				sshCon[1].out.println( ogr2ogr );
				sshCon[1].out.println( "echo '\004'" );
				sshCon[1].out.flush();
						
				reader = sshCon[1].in;
				
			} else {
				p = Runtime.getRuntime().exec( gdal, null, workdir );
				p.waitFor();
				
				reader = new BufferedReader(new InputStreamReader( p.getInputStream() ) );
			}
	  		  
			String line = reader.readLine();			
			while (line != null && ! line.equals("\004")) {
				line = reader.readLine();
			}
			
			if( remote ) {
				sshCon[1].out.println( "cat " + kml_file );
				sshCon[1].out.println( "echo -n '\004'" );
				sshCon[1].out.flush();
				
				Writer writer = new BufferedWriter(new OutputStreamWriter( new FileOutputStream( workdir + "/" + kml_file ) ) );
				int ret = sshCon[1].in.read( sshCon[1].buffer, 0, sshCon[1].buffer.length );
				while( ret > 0 ) {
					if( sshCon[1].buffer[ ret - 1 ] == '\004' ) {
						ret -= 1;
						writer.write( sshCon[1].buffer, 0, ret );
						break;
					}
					writer.write( sshCon[1].buffer, 0, ret );
					ret = sshCon[1].in.read( sshCon[1].buffer, 0, sshCon[1].buffer.length );
				}
				writer.close();
			}
			
			p = Runtime.getRuntime().exec( kml_parser, null, workdir );
			p.waitFor();
			
			reader = new BufferedReader(new InputStreamReader( p.getInputStream() ) );
			  
			line = reader.readLine();
			while (line != null) {
				line = reader.readLine();
			}
				  
		} catch (IOException | InterruptedException e) {
			e.printStackTrace();
			return 1;
		}		
		
		return 0;
		
	}
	
	private int addPoiResults( String id ) {
		
		/* Nothing to do if a raw computation was requested. */
		if( task.raw > 0 )
			return 0;
		
		try {
				
			/* copy remote POI file to local worker instance */
			if( remote ) {
				
				BufferedReader reader = null;
				PrintStream poiFile = new PrintStream( workdir + "/eWave.poi.summary" );
				
				sshCon[1].out.println( "cat eWave.poi.summary" );
				sshCon[1].out.println( "echo '\004'" );
				sshCon[1].out.flush();
				reader = sshCon[1].in;
				
				String line = reader.readLine();
				while (line != null && ! line.equals("\004")) {
					poiFile.println( line );
					line = reader.readLine();
				}
				
				poiFile.close();
			}
														
			File f = new File( workdir + "/eWave.poi.summary" );
			BufferedReader reader = new BufferedReader( new FileReader( f ) );
						
			/* skip headline */
			reader.readLine();
			
		    String line;
		    while( (line = reader.readLine()) != null ) {
		    	String[] data = line.split( "\\s+" );
		    	
		    	/* ignore stations at this point */
		    	if( data[0].startsWith("s_") )
		    		continue;
		    	
		    	/* distinguish between TFP ans TSP */
		    	DBObject poi;
		    	poi = data[0].startsWith("tsp_") ? tsps.get( data[0] ) : tfps.get( data[0] );
		    	poi.put( "eta", Double.valueOf( data[1] ) );
		    	poi.put( "ewh", Double.valueOf( data[2] ) );
		    }
		    
		    reader.close();
		    
		    DBCollection coll = dbclient.getDB( "easywave" ).getCollection("tfp_comp");
		    
		    for( DBObject obj: tfps.values() ) {
		    	coll.insert( obj );
		    }
		    
		    coll = dbclient.getDB( "easywave" ).getCollection("comp");
		    
		    HashMap<Integer,Double> maxEWH = new HashMap<Integer, Double>();
		    HashMap<Integer,Double> minETA = new HashMap<Integer, Double>();
		    for( DBObject obj: tsps.values() ) {
		    	obj.put("type", "TSP");
		    	coll.insert( obj );
		    	
		    	Double ewh = (Double) obj.get("ewh");
		    	Double eta = (Double) obj.get("eta");
		    	Integer cfcz = (Integer) obj.get("cfcz");
		    	if( ! maxEWH.containsKey(cfcz) ) {
		    		maxEWH.put(cfcz, ewh);
		    		minETA.put(cfcz, eta);
		    	}
		    	maxEWH.put(cfcz, Math.max( maxEWH.get(cfcz), ewh ) );
		    	minETA.put(cfcz, Math.min( minETA.get(cfcz), eta ) );    	
		    }
		    
		    for( Integer key: maxEWH.keySet() ) {
		    	DBObject cfz = new BasicDBObject();
		    	cfz.put("code", key);
		    	cfz.put("type", "CFZ");
		    	cfz.put("ewh", maxEWH.get(key));
		    	cfz.put("eta", minETA.get(key));
		    	cfz.put( "EventID", id );
		    	coll.insert( cfz );
		    }
			
		} catch (IOException e) {
			e.printStackTrace();
			return 1;
		}
		
		return 0;
	}
	
	private int addStationResults( TaskParameter task ) {
		
		/* Nothing to do if a raw computation was requested. */
		if( task.raw > 0 )
			return 0;
		
		try {
		
			/* copy remote POI file to local worker instance */
			if( remote ) {
				
				BufferedReader reader = null;
				PrintStream poiFile = new PrintStream( workdir + "/eWave.poi.ssh" );
				
				sshCon[1].out.println( "cat eWave.poi.ssh" );
				sshCon[1].out.println( "echo '\004'" );
				sshCon[1].out.flush();
				reader = sshCon[1].in;
				
				String line = reader.readLine();
				while (line != null && ! line.equals("\004")) {
					poiFile.println( line );
					line = reader.readLine();
				}
				
				poiFile.close();
			}
			
			long start = System.currentTimeMillis();
			
			File f = new File( workdir + "/eWave.poi.ssh" );
			BufferedReader reader = new BufferedReader( new FileReader( f ) );
		
			String line;
			ArrayList<Integer> statIds = new ArrayList<Integer>();
			ArrayList<String> statNames = new ArrayList<String>();
			
			DBCollection simData = dbclient.getDB( "easywave" ).getCollection("simsealeveldata");
			DBObject obj;
			List<DBObject> objList = new ArrayList<DBObject>();
			
			/* translate date into time stamp */
			long time = task.eqparams.date.getTime() / 1000;
			
		    while( (line = reader.readLine()) != null ) {
		    	String[] data = line.trim().split( "\\s+" );
		    	
		    	/* search for stations in headline and store related index (station ids start with s_) */
		    	if( statIds.size() == 0 ) {
		    		
		    		for( int i = 1; i < data.length; i++ )
		    			if( data[i].startsWith("s_") ) {
		    				statIds.add(i);
		    				statNames.add( data[i].substring(2) );
		    			}
		    				
		    		continue;
		    	}
		    	
		    	long rel_time = (long)(Float.valueOf(data[0]) * 60);
		    	
		    	if( rel_time > task.duration * 60 )
		    		break;
		    	
		    	rel_time /= task.accel;
		    	long stamp = time + rel_time;
		    			    	
		    	/* extract value of each station for the next timestamp */
		    	for( int i = 0; i < statIds.size(); i++ ) {   		
		    				    		
		    		/* write the simulation data directly into the database because of performance reasons */
		    		obj = new BasicDBObject();
		    		obj.put("inst", task.user.inst );
		    		obj.put("timestamp", stamp);
		    		obj.put("reltime", rel_time);
		    		obj.put("station", statNames.get(i));
		    		obj.put("value", data[ statIds.get(i) ]);
		    		obj.put("evid",task.id);
		    				    
		    		objList.add( obj );
		    	}	
		    }
			
			reader.close();
			long duration1 = System.currentTimeMillis() - start;
			
			/* bulk insert */
			simData.insert( objList, WriteConcern.UNACKNOWLEDGED );
			
			long duration2 = System.currentTimeMillis() - start;
			System.out.println( duration1 + " - " + duration2 );			
			
		} catch (IOException e) {
			e.printStackTrace();
			return 1;
		}
		
		return 0;
	}
	
	private void saveRawData( TaskParameter task ) {
		if( ! remote )
			throw new UnsupportedOperationException("saveRawData() not yet available as local version.");		
		
		DBObject dirs = dbclient.getDB("easywave").getCollection("settings").findOne(new BasicDBObject("type", "dirs"));
		String resdir = (String) dirs.get("results");
		String mkdir = String.format("mkdir -p %s/events/%s", resdir, task.id);
		String rm = String.format("rm %s/events/%s/*", resdir, task.id);
		String mv = String.format("mv * %s/events/%s/", resdir, task.id);
		
		sshCon[1].out.println(mkdir);
		sshCon[1].out.println(rm);
		sshCon[1].out.println(mv);
		sshCon[1].out.println("echo '\004'");
		sshCon[1].out.flush();
	}
	
	private int pyPostProcess( TaskParameter task ) {
		
		Services.sendPost(GlobalParameter.wsgi_url + "webguisrv/post_compute", "evtid=" + task.id.toString());		
		return 0;
	}
	
	@Override
	public int compareTo( WorkerThread o ) {
		return priority.compareTo( o.priority );
	}
	
	private TaskParameter getWork() throws InterruptedException {
		
		synchronized( lock ) {
						
			workerQueue.offer( this );
			task = null;
			
			while( task == null )
				lock.wait();
			
		}
		
		return task;
	}
	
	public void putWork( TaskParameter task ) {
		
		this.task = task;
		
		synchronized( lock ) {
			lock.notify();
		}
		
	}

}
