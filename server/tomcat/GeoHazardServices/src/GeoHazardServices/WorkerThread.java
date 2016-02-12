package GeoHazardServices;

import java.io.File;
import java.io.IOException;
import java.net.UnknownHostException;
import java.util.Arrays;

import FloodPrototype.FloodAdapter;
import FloodPrototype.FloodTask;
import Misc.SshConnection;
import Tsunami.EasyWaveAdapter;
import Tsunami.HySeaAdapter;
import Tsunami.TsunamiAdapter;

import com.mongodb.DB;
import com.mongodb.MongoClient;
import com.mongodb.ServerAddress;

public class WorkerThread implements Runnable, Comparable<WorkerThread> {

	private IScheduler scheduler;
	private File workdir;
	private SshConnection[] sshCon;
	
	private Thread thread;
	private MongoClient dbclient;
	private DB db;
	
	private String hardware;
	
	private Integer priority;
	private int slot = IScheduler.SLOT_NORMAL;
	private Object lock;
	private Task task;
	
	private FloodAdapter floodAdapter;
	private TsunamiAdapter hySeaAdapter;
	private TsunamiAdapter easyWaveAdapter;
	
	public WorkerThread( IScheduler scheduler,
						 String workdir ) throws IOException {
		
		this.scheduler = scheduler;
		this.lock = new Object();
		this.priority = new Integer( 0 );
		
		this.workdir = new File( workdir );
		
		if( this.workdir.mkdir() == false ) {
			throw new IOException( "Could not create working directory!" );
		}
				
		try {
			
			dbclient = new MongoClient(Arrays.asList(
			   new ServerAddress("tcnode1", 27017),
			   new ServerAddress("tcnode2", 27017),
			   new ServerAddress("tcnode3", 27017))
			);
			db = dbclient.getDB("trideccloud");
			
		} catch (UnknownHostException e) {
			e.printStackTrace();
		}
	}
		
	public int setRemote( String user, String host, String dir ) {
				
		sshCon = new SshConnection[2];
				
		for( int i = 0; i < 2; i++ ) {
			
			try {
				sshCon[i] = new SshConnection(user, host, dir);
			} catch (IOException e) {
				e.printStackTrace();
				return 1;
			}
		}
		
		/* TODO: not the right place */
		try {
			floodAdapter = new FloodAdapter(db, sshCon, workdir, hardware);
			hySeaAdapter = new HySeaAdapter(db, sshCon, workdir, hardware);
			easyWaveAdapter = new EasyWaveAdapter(db, sshCon, workdir, hardware);
		} catch(IOException e) {
			e.printStackTrace();return 1;
		}
		
		return 0;
	}
	
	public void setHardware( String hardware ) {
		this.hardware = hardware;
	}
	
	public void setPriority( int priority ) {
		this.priority = priority;
	}
	
	public void setSlot( int slot ) {
		this.slot = slot;
	}
	
	public int getSlot() {
		return this.slot;
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
		
		System.out.println("Thread " + this.thread.getId() + " started");
		
		while( true ) {
		
			try {
				getWork();
				checkSshConnection();
				
				System.out.println("Thread " + this.thread.getId() + " computes event " + task.id );
				int ret = 0;
				if( task instanceof EQTask ) {
					if( ((EQTask) task).algo.equals("hysea") ) {
						ret = hySeaAdapter.handleRequest(task);
					} else {
						//handleRequest( (EQTask) task );
						ret = easyWaveAdapter.handleRequest(task);
					}
				} else if( task instanceof FloodTask ) {
					ret = floodAdapter.handleRequest(task);
				}
				
				if(ret > 0) task.markAsDone(); else task.markAsError();
						
			} catch (InterruptedException e) {
				break;
			}
		}
		
	}
		
	private int checkSshConnection() {
		/* check if ssh connection is still established */
		sshCon[0].out().println( "echo '\n'" );
		sshCon[0].out().flush();
		try {
			if( sshCon[0].in().readLine() == null ) {
				System.err.println( "Error: ssh connection was closed. Trying to reconnect..." );
				sshCon[0].connect();
				sshCon[1].connect();
			}
		} catch (IOException e) {
			e.printStackTrace();
			return 1;
		}
		return 0;
	}
			
	@Override
	public int compareTo( WorkerThread o ) {
		return priority.compareTo( o.priority );
	}
	
	private Task getWork() throws InterruptedException {
		synchronized( lock ) {
			task = null;
			scheduler.submit( this );
			
			while( task == null )
				lock.wait();
			
			return task;
		}
	}
	
	public void putWork( Task task ) {
		synchronized( lock ) {
			this.task = task;
			lock.notify();
		}
		
	}

}
