package GeoHazardServices;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.PrintStream;
import java.io.Writer;
import java.net.UnknownHostException;
import java.util.Date;
import java.util.concurrent.PriorityBlockingQueue;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.mongodb.BasicDBList;
import com.mongodb.BasicDBObject;
import com.mongodb.DBCollection;
import com.mongodb.DBObject;
import com.mongodb.MongoClient;
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
		
		if( startEasyWave( task ) != 0 ) {
			task.status = TaskParameter.STATUS_ERROR;
			return 0;
		}
										
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
		
		String fault = 	"-mw " + eqp.mw +
						" -location " + eqp.lon + " " + eqp.lat + " " + eqp.depth +
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
	
	private int startEasyWave( TaskParameter task ) {
								
		Process p = null;
		int simTime = task.duration + 10;
		
		String cmdParams = " -grid ../gridtwo.grd -poi ../points-all.csv -poi_dt_out 0 -source fault.inp -propagation 10 -step 1 -ssh_arrival 0.001 -time " + simTime + " -verbose -adjust_ztop -gpu";
			
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
					}
					
					/* check if a new process entry was inserted previously - return otherwise */
					if( processIndex < 0 ) {
						System.err.println( "Error: Invalid index into process array!" );
						return 1;
					}
						
					/* DB object to find current earthquake ID */
					BasicDBObject obj = new BasicDBObject("_id", task.id );
					
					/* create sub-object that is used to update the current progress */
					BasicDBObject setter = new BasicDBObject();
					setter.put( "process." + processIndex + ".progress", task.progress );
					setter.put( "process." + processIndex + ".curSimTime", totalMin );
					setter.put( "process." + processIndex + ".calcTime", calcTime );
					
					/* build update query */
					BasicDBObject update = new BasicDBObject( "$set", setter );
					
					/* update the DB entry with the given ID*/
					coll.update( obj, update );
												
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
					
				} else {
					
					/* this is the first time after simulation start - insert process entry */
					matcher = Pattern.compile( "range: (.*) (.*) (.*) (.*)" ).matcher( line );
					if( matcher.find() ) {
						
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
						dbObject.put( "resolution", 2 );
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
				
		Process p;
				
		/* TODO: adapt EasyWave to really get arrivals for the specific time and not for time - 1 */
		String gdal = String.format( "gdal_contour -f kml -i 10 -fl %d eWave.2D.%05d.time arrival.%d.kml",
									  time - 10, time * 60, time - 10);
		
		String kml_parser = String.format( "python ../getShape.py arrival.%d.kml %d %s", time - 10, time - 10, id );
		
		String kml_file = String.format( "arrival.%d.kml", time - 10 );
		
		try {
						
			BufferedReader reader = null;
			
			if( remote ) {
					
				/* ssh should be okay upon here, therefore run commands */
				sshCon[1].out.println( gdal );
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
		
		Process p;
				
		String gdal = String.format( "gdal_contour -f kml -fl %s eWave.2D.sshmax heights.%s.kml", ewh, ewh);
		
		String kml_parser = String.format( "python ../getEWH.py heights.%s.kml %s %s", ewh, ewh, id );
		
		String kml_file = String.format( "heights.%s.kml", ewh );
		
		try {
						
			BufferedReader reader = null;
			
			if( remote ) {
					
				/* ssh should be okay upon here, therefore run commands */
				sshCon[1].out.println( gdal );
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
				
		String poi_parser = "python ../getPois.py eWave.poi.summary " + id;
		
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
					
			/* run python script that inserts the POIs into the database */
			Runtime.getRuntime().exec( poi_parser, null, workdir ).waitFor();
			
		} catch (InterruptedException | IOException e) {
			e.printStackTrace();
			return 1;
		}
		
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
