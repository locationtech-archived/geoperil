package GeoHazardServices;

import java.io.BufferedReader;
import java.io.DataOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.UnknownHostException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.TimeZone;
import java.util.UUID;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.PriorityBlockingQueue;

import javax.inject.Singleton;
import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.ws.rs.CookieParam;
import javax.ws.rs.DefaultValue;
import javax.ws.rs.FormParam;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;

import org.bson.types.ObjectId;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.mongodb.AggregationOutput;
import com.mongodb.BasicDBList;
import com.mongodb.BasicDBObject;
import com.mongodb.DB;
import com.mongodb.DBCollection;
import com.mongodb.DBCursor;
import com.mongodb.DBObject;
import com.mongodb.MongoClient;
import com.mongodb.MongoException;
import com.mongodb.util.Base64Codec;

class User {
	
	public String name;
	public Object objId;
	public String inst;
	
	public User( DBObject obj ) {
		this( obj, null );
	}
	
	public User( DBObject obj, DBObject instObj ) {
		
		this.objId = (Object) obj.get( "_id" );
		this.name = (String) obj.get( "username" );
		
		if( instObj != null )
			inst = (String) instObj.get( "name" );
	}
	
}

class Inst extends User {
	
	public String secret;
	
	public Inst( DBObject obj ) {
		
		super( obj );
		this.name = (String) obj.get( "name" );
		this.secret = (String) obj.get( "secret" );
		this.inst = this.name;
	}
	
}

class CompId {
	
	private String compId;
	public String inst;
	public String id;
	public long refineId;
	
	public CompId( String compId ) {
		this.compId = compId;
		setSingleIds();
	}
	
	public CompId( String inst, String id, long refineId  ) {
		this.inst = inst;
		this.id = id;
		this.refineId = refineId;
		this.compId = getCompId();
	}
	
	private String getCompId() {
		return id + "_" + inst + "_" + refineId;
	}
	  
	private void setSingleIds() {
	  
		String[] parts = compId.split("_");
		
		int len = parts.length;
		
		inst = parts[ --len ];
		refineId = Integer.valueOf( parts[ --len ] );
		id = parts[ 0 ];
		
		for( int i = 1; i < len; i++ )
			id += "_" + parts[i];
	}
	
	@Override
	public String toString() {
		return compId;
	}
}

class DateComparator implements Comparator<DBObject> {
	
	private String key;
	private int order;
	
	public DateComparator( String key, int order ) {
		
		this.key = key;
		this.order = order;
	}
	
    @Override
    public int compare(DBObject o1, DBObject o2) {
    	
    	Date d1 = (Date) o1.get( key );
    	Date d2 = (Date) o2.get( key );
    	
        return d1.compareTo( d2 ) * order;
    }
}

@Path("")
@Singleton /* Use one global instance of this class instead of creating a new one for each request */
public class Services {

  private BlockingQueue<TaskParameter> queue;
  private PriorityBlockingQueue<WorkerThread> workerQueue;
  private final int capacity = 3000;
  private ArrayList<WorkerThread> worker;
  private final int numWorker = 6;
  
  private MongoClient mongoClient;
  private DB db;
  private Gson gson;
  
  private Map<String,Inst> institutions;
	
  public Services() {
	  
	  System.out.println("Constructor");
	  queue = new ArrayBlockingQueue<TaskParameter>(capacity);
	  workerQueue = new PriorityBlockingQueue<WorkerThread>(100);
	  worker = new ArrayList<WorkerThread>();
	  	  	  
	  try {
		  
		mongoClient = new MongoClient();
		db = mongoClient.getDB( "easywave" );
		
	  } catch (UnknownHostException e) {
		// TODO Auto-generated catch block
		e.printStackTrace();
	  }
	  
	  loadSettings();
	  
	  new Thread( new WorkScheduler( queue, workerQueue ) ).start();
	  	  
	  loadInstitutions();
	  
	  gson = new Gson();
	  	  
	  Listener.registerService( this );
  }
  
  public void destroy() {
 	
 	 mongoClient.close();
 	
 	 for( int i = 0; i < numWorker; i++ ) {
 		 worker.get(i).stop();
 	 }
  }
  
  private void loadSettings() {
	  
	  System.out.println("Load settings...");
	  
	  DBCollection coll = db.getCollection("settings");
	  
	  DBCursor cursor = coll.find( new BasicDBObject("type", "parameter") );
	  for( DBObject obj: cursor ) {
		  String name = (String) obj.get("name");
		  String value = (String) obj.get("value");
		  
		  GlobalParameter.map.put( name, value );
		  System.out.println("Parameter " + name + ": " + value);
	  }
	  cursor.close();
	  
	  cursor = coll.find( new BasicDBObject("type", "jet_color") );
	  for( DBObject obj: cursor ) {
		  Double threshold = (Double) obj.get("threshold");
		  String color = (String) obj.get("color");
		  
		  GlobalParameter.jets.put( threshold, color );
		  System.out.println("Tsunami-Jet-Threshold " + threshold + ": " + color);
	  }
	  cursor.close();
	  
	  DBObject urls = coll.findOne(new BasicDBObject("type", "urls"));
	  GlobalParameter.wsgi_url = (String) urls.get("wsgi");
	  
	  int j = 0;
	  
	  cursor = coll.find( new BasicDBObject("type", "worker") );
	  for( DBObject obj: cursor ) {
		  
		  String hardware = (String) obj.get("hardware");
		  String user = (String) obj.get("user");
		  String host = (String) obj.get("host");
		  String dir = (String) obj.get("dir");
		  String args = (String) obj.get("args");
		  /* MongoDB stores all integer values as Long (bug?), so convert back here */
		  Integer count = ((Long) obj.get("count")).intValue();
		  int priority = ((Long) obj.get("priority")).intValue();
		  boolean remote = (boolean) obj.get("remote");
		  		  
		  if( count == null )
			  count = 1;
		  
		  System.out.print("Worker " + count + "x " + hardware + " @ " + priority );
		  if( remote )
			  System.out.print(", Remote: " + user + "@" + host + ":" + dir );
		  System.out.println(", Args: " + args);
		  
		  for( int i = 0; i < count; i++, j++ ) {
			  
			  WorkerThread thread;
			  try {
				  thread = new WorkerThread( workerQueue, GlobalParameter.map.get("localdir") + "/w" + j );
			  } catch (IOException e) {
				  System.err.println("Error: Could not create worker thread.");
				  e.printStackTrace();
				  continue;
			  }
			  
			  thread.setRemote( user, host, dir + i );
			  thread.setHardware(hardware);
			  thread.setPriority(priority);
			  
			  worker.add( thread );
			  thread.start();
		  }
		  
	  }
	  cursor.close();
  }
  
  private void loadInstitutions() {
	  	  
	  institutions = new HashMap<String,Inst>();
	  
	  DBCollection coll = db.getCollection("institutions");
	  
	  DBCursor cursor = coll.find();
	  
	  for( DBObject obj: cursor ) {
		  Inst inst = new Inst( obj );
		  institutions.put( inst.name, inst );
	  }
	  
	  cursor.close();
  }
      
  private boolean checkParams( HttpServletRequest request, Object[] list ) {

	  for( Object o: list ) {
		  if( o == null )
			  return false;
	  }
	  
	  return true;
  }
  
  @POST
  @Path("/computeById")
  @Produces(MediaType.APPLICATION_JSON)
  public String computeById(
		  @Context HttpServletRequest request,
		  @FormParam("inst") String inst,
		  @FormParam("secret") String secret,
		  @FormParam("id") String id,
		  @FormParam("refineId") Long refineId,
		  @FormParam("dur") Integer dur,
		  @FormParam("accel") Integer accel ) {
	  	  		
	  Object[] required = { inst, secret, id, refineId, dur };
	  
	  /* check required parameters */
	  if( ! checkParams( request, required ) )
		  return jsfailure();
	  
	  /* check if we got a valid institution and the correct secret */
	  Inst instObj = institutions.get( inst );
	  if( instObj == null || ! instObj.secret.equals( secret ) )
		  return jsdenied();
	  	  	
	  /* search for given id */
	  CompId compId = new CompId( inst, id, refineId );
	  BasicDBObject query = new BasicDBObject( "_id", compId.toString() );
	  DBCursor cursor = db.getCollection("eqs").find( query );
	  	  
	  /* return if id not found */
	  if( cursor.count() != 1 )
		  return jsfailure();
	
	  /* get properties of returned entry */
	  BasicDBObject entry = (BasicDBObject) cursor.next();
	  BasicDBObject prop = (BasicDBObject) entry.get("prop");
	
	  /* clean up query */
	  cursor.close();
	  	  	  
	  BasicDBObject process = new BasicDBObject( "process", new BasicDBList() );
	  BasicDBObject set = new BasicDBObject( "$set", process );
	  db.getCollection("eqs").update( entry, set );
	  	  
	  /* extract properties to pass them to the request method */
	  double lat = prop.getDouble("latitude");
	  double lon = prop.getDouble("longitude");
	  double mag = prop.getDouble("magnitude");
	  double dip = prop.getDouble("dip");
	  double strike = prop.getDouble("strike");
	  double rake = prop.getDouble("rake");
	  double depth = prop.getDouble("depth");
	  Date date = prop.getDate("date");
	
	  if( accel == null )
		  accel = 1;
	  
	  /* prepare the simulation for execution */
	  return request( lon, lat, mag, depth, dip, strike, rake, compId.toString(), instObj, dur, date, accel );
  }

  private String request( double lon, double lat, double mag, double depth, double dip,
		  				 double strike, double rake, String id, User user, int dur,
		  				 Date date, int accel ) {
	  	  
	  EQParameter eqp = new EQParameter(lon, lat, mag, depth, dip, strike, rake, date);
	  TaskParameter task = new TaskParameter( eqp, id, user, dur, accel );
	  		  
	  if( queue.offer( task ) == false ) {
		  System.err.println("Work queue is full");
		  return jsfailure();
	  }
	  	  
	  return jssuccess( new BasicDBObject( "_id", id ) );
  }
      
  String newRandomId( String username ) {
	  
	  Random rand = new Random();
	  String id;
	  
	  DBCollection coll = db.getCollection("eqs");
	  
	  while ( true ) {
		  
		  Integer nr = rand.nextInt( 90000 ) + 10000;
		  id = username + nr.toString(); 
		
		  if( coll.find( new BasicDBObject("_id", id) ).count() == 0 )
			  break;
	  }
	  
	  return id;
  }
  
  @POST
  @Path("/compute")
  @Produces(MediaType.APPLICATION_JSON)
  public String compute(
		  @Context HttpServletRequest request,
		  @FormParam("name") @DefaultValue("Custom") String name,
		  @FormParam("lon") Double lon, 
		  @FormParam("lat") Double lat,
		  @FormParam("mag") Double mag,
		  @FormParam("depth") Double depth,
		  @FormParam("dip") Double dip,
		  @FormParam("strike") Double strike,
		  @FormParam("rake") Double rake,
		  @FormParam("dur") Integer dur,
		  @FormParam("date") String dateStr,
		  @FormParam("root") String root,
		  @FormParam("parent") String parent,
		  @CookieParam("server_cookie") String session) {
	  	  	  
	  Object[] required = { name, lon, lat, mag, depth,
							dip, strike, rake, dur };

	  if( ! checkParams( request, required ) )
		  return jsfailure();
	  
	  /* only privileged users are allowed to compute own scenarios - check for valid session */
	  if( session == null )
		  return jsdenied();
	  	  
	  /* check if session is valid and if the user is logged in */
	  User user = signedIn( session );
	  
	  if( user == null )
		  return jsdenied();
	  
	  Date date;
	  if( dateStr != null && ! dateStr.equals("") ) {
		  
		  /* get Date object from date string */
		  date = parseIsoDate( dateStr );
		  
	  } else {
		  
		  /* get current timestamp */
		  date = new Date();
	  }
	  
	  if( date == null )
		  return jsfailure();
	  
	  System.out.println( new Date() + ": User " + user.name + " requested a computation of " + dur + " minutes." );
	  
	  /* upon here, we assume an authorized user */
	  if( root != null && root.equals("") )
		  root = null;
	  
	  if( parent != null && parent.equals("") )
		  parent = null;
		  
	  /* get collection that stores the earthquake entries */
	  DBCollection coll = db.getCollection("eqs");
	  
	  /* create an unique ID that is not already present in the DB */
	  String id = newRandomId(user.name);
	  
	  DBCursor cursor = coll.find( new BasicDBObject("_id", parent) );
	  int accel = 1;
	  if( cursor.hasNext() ) {
		  Integer val = (Integer) cursor.next().get("accel");
		  if( val != null )
			  accel = val;
	  }
	  
	  /* get current timestamp */
	  Date timestamp = new Date();
	  	  	  	  
	  /* create new sub object that stores the properties */
	  BasicDBObject sub = new BasicDBObject();
	  sub.put( "date", date );
	  sub.put( "region", name );
	  sub.put( "latitude", lat );
	  sub.put( "longitude", lon );
	  sub.put( "magnitude", mag );
	  sub.put( "depth", depth );
	  sub.put( "dip", dip );
	  sub.put( "strike", strike );
	  sub.put( "rake", rake );
	  	  
	  /* create new DB object that should be added to the earthquake collection */
	  BasicDBObject obj = new BasicDBObject();
	  obj.put( "_id", id );
	  obj.put( "id", id );
	  obj.put( "user", user.objId );
	  obj.put( "timestamp", timestamp );
	  obj.put( "process", new ArrayList<>() );
	  obj.put( "prop", sub );
	  obj.put( "root", root );
	  obj.put( "parent", parent );
	  obj.put( "accel", accel );
	  
	  /* insert object into collection */
	  coll.insert( obj );
	  
	  /* create a new event */
	  BasicDBObject event = new BasicDBObject();
	  event.put( "id", id );
	  event.put( "user", user.objId );
	  event.put( "timestamp", timestamp );
	  event.put( "event", "new" );
	  
	  /* insert new event into 'events'-collection */
	  db.getCollection("events").insert( event );
	  
	  /* start request */
	  return request( lon, lat, mag, depth, dip, strike, rake, id, user, dur, date, accel );
  }
    
  @POST
  @Path("/data_insert")
  @Produces(MediaType.APPLICATION_JSON)
  public String data_insert(
		  @Context HttpServletRequest request,
		  @FormParam("inst") String inst,
		  @FormParam("secret") String secret,
		  @FormParam("id") String id,
		  @FormParam("name") String name,
		  @FormParam("lon") Double lon,
		  @FormParam("lat") Double lat,
		  @FormParam("mag") Double mag,
		  @FormParam("depth") Double depth,
		  @FormParam("dip") Double dip,
		  @FormParam("strike") Double strike,
		  @FormParam("rake") Double rake,
		  @FormParam("date") String dateStr,
		  @FormParam("sea_area") String sea_area,
		  @FormParam("root") String root,
		  @FormParam("parent") String parent,
		  @FormParam("comp") Integer comp,
		  @FormParam("accel") Integer accel) {
	  
	  Object[] required = { inst, secret, id, name, dateStr };
	  	  	  	  
	  System.out.println(id);
	  
	  if( ! checkParams( request, required ) )
	  	  return jsfailure();
	  	  		  	  	  
	  /* check if we got a valid institution and the correct secret */
	  Inst instObj = institutions.get( inst );
	  if( instObj == null || ! instObj.secret.equals( secret ) )
		  return jsdenied();
	
	  /* get Date object from date string */
	  System.out.println( dateStr );
	  Date date = parseIsoDate( dateStr );
	  if( date == null )
		  return jsfailure();
	  
	  System.out.println(id);
	  
	  /* get current timestamp */
	  Date timestamp = new Date();
	  
	  /* create new sub object that stores the properties */
	  BasicDBObject sub = new BasicDBObject();
	  sub.put( "date", date );
	  sub.put( "region", name );
	  sub.put( "latitude", lat );
	  sub.put( "longitude", lon );
	  sub.put( "magnitude", mag );
	  sub.put( "depth", depth );
	  sub.put( "dip", dip );
	  sub.put( "strike", strike );
	  sub.put( "rake", rake );
	  sub.put( "sea_area", sea_area );
	  	  
	  if( accel == null )
		  accel = 1;
	  	  
	  /* create new DB object that should be added to the eqs collection */
	  BasicDBObject obj = new BasicDBObject();
	  obj.put( "id", id );
	  obj.put( "user", instObj.objId );
	  obj.put( "timestamp", timestamp );
	  obj.put( "prop", sub );
	  obj.put( "root", root );
	  obj.put( "parent", parent );
	  obj.put( "accel", accel );
	  
	  /* create a new event */
	  BasicDBObject event = new BasicDBObject();
	  event.put( "user", instObj.objId );
	  event.put( "timestamp", timestamp );
	  event.put( "event", "new" );
	  
	  Long refineId = 0L;
	  
	  /* get earthquake collection */
	  DBCollection coll = db.getCollection("eqs");
	  /* search for given id */
	  BasicDBObject inQuery = new BasicDBObject( "id", id );	  
	  DBCursor cursor = coll.find( inQuery ).sort( new BasicDBObject("refineId", -1) );
	
	  BasicDBObject entry = null;
	  
	  /* if id is already used, make a refinement */
	  if( cursor.hasNext() ) {
		  
		  /* get properties of returned entry */
		  entry = (BasicDBObject) cursor.next();
		
		  /* update entry ID in database by appending deprecated field */
		  BasicDBObject depr = new BasicDBObject( "depr", true );
		  coll.update( entry, new BasicDBObject( "$set", depr ) );
		  
		  refineId = (Long) entry.get( "refineId" );
		  
		  if( refineId == null ) {
			  refineId = new Long(0);
		  }
  
		  refineId++;
		  		  
		  /* override parent and root attributes */
		  root = entry.get("root") == null ? (String) entry.get("_id") : (String) entry.get("root");
		  obj.put( "root", root );
		  obj.put( "parent", entry.get("_id") );

		  /* override event type */
		  event.put( "event", "update" );
	  }
	  
	  /* set refinement and compound Ids */
	  final CompId compId = new CompId( instObj.name, id, refineId );
	  obj.put( "_id", compId.toString() );
	  obj.put( "refineId", refineId );
	  event.put( "id", compId.toString() );

	  /* clean up query */
	  cursor.close();
	  	  	  	  	  	  
	  /* insert object into 'eqs' collection */
	  coll.insert( obj );
	  	  
	  System.out.println(obj);
	  
	  Object[] reqComp = { inst, secret, id, lon, lat, mag, depth, dip, strike, rake };
	  boolean simulate = comp != null && checkParams( request, reqComp );
	  	  
	  /* insert new event into 'events'-collection */
	  db.getCollection("events").insert( event );
	  	  
	  if( simulate )
		  computeById( request, inst, secret, id, refineId, comp, accel );
	  else
		  /* run request in a separate thread to avoid blocking */
		  new Thread() {
		  	public void run() {
		  		sendPost(GlobalParameter.wsgi_url + "webguisrv/post_compute", "evtid=" + compId.toString());
		  	}
		  }.start();
			 
	  return jssuccess( new BasicDBObject( "refineId", refineId ) );
  }
       
  private String getHash( String password ) {
	  
	  MessageDigest sha256;
	  
	  try {
		sha256 = MessageDigest.getInstance("SHA-256");
	  } catch (NoSuchAlgorithmException e) {
		return null;
	  }
	  
	  Base64Codec base64Codec = new Base64Codec();
	  		  
	  return base64Codec.encode( sha256.digest( password.getBytes() ) );
  }
  
  private boolean checkPassword( String username, String password ) {
	  
	  DBCollection coll = db.getCollection("users");
  	  
	  DBCursor cursor = coll.find( new BasicDBObject("username", username) );
	  
	  if( ! cursor.hasNext() )
		  return false;
		  		  
	  DBObject obj = cursor.next();
	  String hash1 = (String) obj.get( "password" );
	  
	  String hash2 = getHash( password );
	  
	  if( hash1 == null || hash2 == null )
		  return false;
	  	  		  
	  if( hash1.equals( hash2 ) )
		  return true;
	  
	  return false;
  }
  
  @POST
  @Path("/signin")
  @Produces(MediaType.APPLICATION_JSON)
  public String signin(
		  @Context HttpServletRequest request,
		  @Context HttpServletResponse response,
		  @FormParam("username") String username,
		  @FormParam("password") String password ) {
	  	  
	  Cookie sessionCookie = new Cookie("server_cookie", "java!");
	  sessionCookie.setPath("/");
	  sessionCookie.setHttpOnly( true );
	  //sessionCookie.setSecure( true );
	 	  
	  if( username == null || password == null || username.equals("") || password.equals("") )
		  return jsfailure();
	  	  	 	  	  	  
	  DBCollection coll = db.getCollection("users");
	  	  
	  DBCursor cursor = coll.find( new BasicDBObject("username", username) );
	  DBObject obj;
	  	  
	  if( cursor.hasNext() ) {
		  		  
		  obj = cursor.next();
		  String hash = (String) obj.get( "password" );
		  String session = (String) obj.get( "session" );
		  
		  MessageDigest sha256;
		  
		  try {
			sha256 = MessageDigest.getInstance("SHA-256");
		  } catch (NoSuchAlgorithmException e) {
			return "{ \"status\": \"error\" }";
		  }
		  
		  Base64Codec base64Codec = new Base64Codec();
		  		  
		  if( hash.equals( base64Codec.encode( sha256.digest( password.getBytes() ) ) ) ) {
			  
			  if( session == null ) {
				  session = getSessionKey();
				  obj.put("session", session);
				  coll.update( new BasicDBObject("username", username), obj );
			  }

			  sessionCookie.setValue( session );
			  response.addCookie( sessionCookie );
			  					  
			  BasicDBObject result = new BasicDBObject("status", "success");
			  result.put( "user", getUserObj(username) );
			  
			  BasicDBObject perm = (BasicDBObject) obj.get("permissions");
			  if( perm != null && perm.getBoolean("nologin") == true )
				  return jsdenied( new BasicDBObject("nologin", true) );
			  
			  System.out.println( "CLOUD " + new Date() + " SignIn from user " + username );
			  
			  return gson.toJson( result );
		  }
	  }
	  
	  return jsfailure();
  }
  
  @POST
  @Path("/signout")
  @Produces(MediaType.APPLICATION_JSON)
  public String signout(
		  @Context HttpServletRequest request,
		  @Context HttpServletResponse response,
		  @FormParam("username") String username,
		  @CookieParam("server_cookie") String session ) {
	  
	  if( username == null || username.equals("") || session == null )
		  return jsfailure();
		  	  
	  DBCollection coll = db.getCollection("users");
	  
	  DBCursor cursor = coll.find( new BasicDBObject("username", username) );
	  DBObject obj;
	  
	  if( cursor.hasNext() ) {
		
		  obj = cursor.next();
		  
		  if( session.equals( (String) obj.get( "session" ) ) ) {
			  
			  obj.put("session", null);
			  coll.update( new BasicDBObject("username", username), obj );
			  
			  Cookie sessionCookie = new Cookie("server_cookie", "");
			  sessionCookie.setPath("/");
			  sessionCookie.setMaxAge( 0 );
			  response.addCookie( sessionCookie );
			  
			  System.out.println( "CLOUD " + new Date() + " SignOut from user " + username );
			  return jssuccess();
		  }
	  }
	  	  
	  return jsfailure();
  }
		  
  @POST
  @Path("/session")
  @Produces(MediaType.APPLICATION_JSON)
  public String session(
		  @Context HttpServletRequest request,
		  @Context HttpServletResponse response,
		  @CookieParam("server_cookie") String session ) {
	  
	  if( session == null )
		  return jsfailure();
	  	  
	  User user = signedIn( session );
	  
	  if( user != null ) {
		  
		  DBObject userObj = getUserObj( user.name );
		  BasicDBObject result = new BasicDBObject("status", "success");
		  result.put( "user", userObj );
		  
		  BasicDBObject perm = (BasicDBObject) userObj.get("permissions");
		  if( perm != null && perm.getBoolean("nologin") == true )
			  return jsdenied( new BasicDBObject("nologin", true) );
		  
		  System.out.println( "CLOUD " + new Date() + " Resuming session for user " + user.name );
		  
		  return gson.toJson( result );
	  }
	  
	  return jsfailure();
  }
  
  private DBObject getUserObj( String username ) {
	  
	  DBCollection coll = db.getCollection("users");
	  
	  DBCursor cursor = coll.find( new BasicDBObject("username", username) );
	  
	  if( ! cursor.hasNext() )
		  return null;
	  
	  DBObject obj = cursor.next();
	  cursor.close();
	  
	  BasicDBObject userObj = new BasicDBObject( "username", obj.get("username") );
	  userObj.put( "_id", obj.get("_id") );
	  userObj.put( "permissions", obj.get("permissions") );
	  userObj.put( "properties", obj.get("properties") );
	  userObj.put( "notify", obj.get("notify") );
	  userObj.put( "api", obj.get("api") );
	  
	  ObjectId instId = (ObjectId) obj.get("inst");
	  
	  cursor = db.getCollection("institutions").find( new BasicDBObject("_id", instId) );
	  
	  String instName = null;
	  
	  if( cursor.hasNext() ) {
		  
		  DBObject inst = cursor.next();
		  inst.removeField("_id");
		  inst.removeField("secret");
		  userObj.put( "inst", inst );
		  instName = (String) inst.get( "name" );
	  }
	  	  
	  cursor.close();
	  
	  if( instName == null || instName.equals("gfz") )
		  instName = "gfz_ex_test";
	  
	  /* get all available country codes and count elements in each group */
	  DBObject groupFields = new BasicDBObject( "_id", "$country" );
	  groupFields.put( "count", new BasicDBObject( "$sum", 1) );
	  
	  DBObject group = new BasicDBObject( "$group", groupFields );
	  
	  BasicDBList types = new BasicDBList();
	  types.add( new BasicDBObject( "sensor", "rad" ) );
	  types.add( new BasicDBObject( "sensor", "prs" ) );
	  types.add( new BasicDBObject( "sensor", "pr1" ) );
	  types.add( new BasicDBObject( "sensor", "flt" ) );
	  types.add( new BasicDBObject( "sensor", null ) );
	  
	  DBObject filterFields = new BasicDBObject( "$or", types );
	  
	  BasicDBList andList = new BasicDBList();
	  andList.add( filterFields );
	  andList.add( new BasicDBObject( "inst", instName ) );
	  
	  DBObject andObj = new BasicDBObject( "$and", andList );
	  DBObject filter = new BasicDBObject( "$match", andObj );
	  
	  /* sort alphabetically */
	  DBObject sortFields = new BasicDBObject("_id", 1);
	  DBObject sort = new BasicDBObject("$sort", sortFields );
	  
	  AggregationOutput output = db.getCollection("stations").aggregate( filter, group, sort );
	  BasicDBList countries = new BasicDBList();
	  
	  /* convert answer into string list */
	  @SuppressWarnings("unchecked")
	  List<String> clist = (List<String>) obj.get("countries");
	  
	  for( DBObject res: output.results() ) {
		  String code = (String) res.get("_id");
		  if( code == null )
			  continue;
		  boolean isOn = (clist != null) && clist.contains( code );
		  res.put( "on", isOn );
		  countries.add( res );
	  }
	  
	  userObj.put("countries", countries);
	  	  
	  return userObj;
  }
  
  private User signedIn( String session ) {
	  	  
	  if( session == null )
		  return null;
	  
	  DBCollection coll = db.getCollection("users");
	  DBCollection insts = db.getCollection("institutions");
	  
	  DBCursor cursor = coll.find( new BasicDBObject("session", session) );
	  DBObject obj;
	  DBObject inst = null;
	  
	  if( cursor.hasNext() ) {
		  
		  /* we have found a valid session key */
		  obj = cursor.next();
		  cursor.close();
		  
		  
		  cursor = insts.find( new BasicDBObject("_id", obj.get("inst")) );
		  if( cursor.hasNext() )
			  inst = cursor.next();
		  
		  return new User( obj, inst );
	  }
	  
	  return null;
  }
    
  public String getSessionKey() {
	  
	  return UUID.randomUUID().toString();
  }
          
 @POST
 @Path("/fetch")
 @Produces(MediaType.APPLICATION_JSON)
 public String fetch(
		  @Context HttpServletRequest request,
		  @FormParam("limit") @DefaultValue("0") int limit,
		  @FormParam("delay") @DefaultValue("0") int delay,
		  @FormParam("undersea") @DefaultValue("false") boolean undersea,
		  @CookieParam("server_cookie") String session) {
	 
	/* check session key and find out if the request comes from an authorized user */
	User user = signedIn( session ); /* returns null if user is not logged in */
	 				
	/* create lists for general and user specific earthquake entries */
	ArrayList<DBObject> mlist = new ArrayList<DBObject>();
	ArrayList<DBObject> ulist = new ArrayList<DBObject>();
	
	/* we want all entries since the beginning of time */
	Date maxTimestamp = new Date(0);
	
	/* used to convert to desired time format used by MongoDB */
	SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
	sdf.setTimeZone( TimeZone.getTimeZone("UTC") );
			
	/* select collection which contain the earthquake entries */
	DBCollection coll = db.getCollection("eqs");
		
	//ArrayList<User> users = new ArrayList<User>( institutions.values() );
	ArrayList<User> users = new ArrayList<User>();
	users.add( user );
	
	if( user != null ) {
								
		if( user.inst != null ) {
			users.add( institutions.get( user.inst ) );
		} else {
			users.add( institutions.get("gfz") );
		}
	}
	
	/* return only entries that are older than 'delay' minutes */
	Date upperTimeLimit = new Date( System.currentTimeMillis() - delay * 60 * 1000 );
	
	/* get earthquakes for each of the given users */
	for( User curUser : users ) {
	
		if( curUser == null )
			continue;
		
		/* create DB query */
		BasicDBObject inQuery = new BasicDBObject( "user", curUser.objId );
		
		if( undersea )
			inQuery.append( "prop.sea_area", new BasicDBObject( "$ne", null ) );
		
		if( delay > 0 )
			inQuery.append( "prop.date", new BasicDBObject( "$lt", upperTimeLimit ) );
				
		inQuery.append( "depr", new BasicDBObject( "$ne", true ) );
		
		/* query DB, sort the results by date and limit the number of returned entries */
		DBCursor cursor = coll.find( inQuery ).sort( new BasicDBObject("prop.date", -1) );
		
		if( limit > 0 )
			cursor = cursor.limit( limit );
					
		/* walk through the returned entries */
		for( DBObject obj: cursor ) {
			
			obj.removeField("image");
			
			/* check if entry belongs to general or user specific list */
			if( user != null && obj.get("user").equals( user.objId ) ) {
				ulist.add( obj );
			} else {
				mlist.add( obj );
			}
			
			/* update timestamp */
			Date timestamp = (Date) obj.get( "timestamp" );
			if( timestamp.after( maxTimestamp ) ) {
				maxTimestamp = timestamp;
			}
		}
		
		/* clean up query */
		cursor.close();
	}
		
	/* create new JSON object that can be used directly within JavaScript */
	JsonObject jsonObj = new JsonObject();	
	jsonObj.add( "main", gson.toJsonTree( mlist ) );	
	jsonObj.add( "user", gson.toJsonTree( ulist ) );
	
	if( user != null ) {
		
		List<DBObject> msglist = msg( limit, user );
		
		if( ! msglist.isEmpty() ) {
			Date timestamp = (Date) msglist.get(0).get("CreatedTime");
			if( timestamp.after( maxTimestamp ) ) {
				maxTimestamp = timestamp;
			}
		}
		
		jsonObj.add( "msg", gson.toJsonTree( msglist ) );
		
	} else {
		
		jsonObj.add( "msg", gson.toJsonTree( new ArrayList<DBObject>() ) );
	}
		
	jsonObj.addProperty("ts", sdf.format( maxTimestamp ) );
						
	return jsonObj.toString();
 }
 	
 @POST
 @Path("/update")
 @Produces(MediaType.APPLICATION_JSON)
 public String update(
		 @Context HttpServletRequest request,
		 @FormParam("ts") String ts,
		 @FormParam("delay") @DefaultValue("0") int delay,
		 @CookieParam("server_cookie") String session ) {
			 
	/* check session key and find out if the request comes from an authorized user */
	User user = signedIn( session );
	 
	/* create lists for general and user specific earthquake entries */
	ArrayList<DBObject> mlist = new ArrayList<DBObject>();
	ArrayList<DBObject> ulist = new ArrayList<DBObject>();
	 
	/* used to convert to desired time format used by MongoDB */
	SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
	sdf.setTimeZone( TimeZone.getTimeZone("UTC") );
	 
	/* convert timestamp from String to Date; return on error */
	Date timestamp;
	
	try {
		timestamp = sdf.parse( ts );
	} catch (ParseException e) {
		e.printStackTrace();
		return null;
	}
		 
	/* select collection which contain the events */
	DBCollection coll = db.getCollection("events");
			
	/* create list of DB objects that contains all desired users */
	BasicDBList users = new BasicDBList();
	
//	for( User curUser: institutions.values() )
//		users.add( new BasicDBObject( "user", curUser.objId ) );
		
	if( user != null ) {
		
		users.add( new BasicDBObject( "user", user.objId ) );
						
		if( user.inst != null ) {
			users.add( new BasicDBObject( "user", institutions.get( user.inst ).objId ) );
		} else {
			users.add( new BasicDBObject( "user", institutions.get("gfz").objId ) );
		}
	}
	
	/* return only entries that are older than 'delay' minutes */
	Date upperTimeLimit = new Date( System.currentTimeMillis() - delay * 60 * 1000 );
	
	/* create DB query - search for newer events related to the general list or the user */
	BasicDBObject inQuery = new BasicDBObject();
	inQuery.put( "timestamp", new BasicDBObject( "$gt", timestamp ) );
	inQuery.put( "$or", users );
				
	boolean first = true;
		
	/* walk through the returned entries */
	if( user != null ) {
		
		/* query DB, sort the results by timestamp */
		DBCursor cursor = coll.find( inQuery ).sort( new BasicDBObject("timestamp", -1) );
		
		for( DBObject obj: cursor ) {
			
			/* get corresponding entry from earthquake collection */
			String id = (String) obj.get("id");
			
			BasicDBObject objQuery = new BasicDBObject();
			objQuery.put( "olduser", new BasicDBObject( "$exists", false ) );
			
			if( delay > 0 )
				objQuery.put( "prop.date", new BasicDBObject( "$lt", upperTimeLimit ) );
			
			DBCursor cursor2;
					
			if( obj.get("event").equals( "msg_sent" ) ) {
				
				objQuery.put( "Message-ID", id );
				cursor2 = db.getCollection("messages_sent").find( objQuery );
							
			} else if( obj.get("event").equals( "msg_recv" ) ) {
				
				objQuery.put( "Message-ID", id );
				cursor2 = db.getCollection("messages_received").find( objQuery );
				
			} else {
				
				objQuery.put( "_id", id );
				cursor2 = db.getCollection("eqs").find( objQuery );
			}
				
			/*  */
			if( cursor2.hasNext() ) {
				
				/* add event type to entry */
				DBObject obj2 = cursor2.next();
				String event = (String) obj.get("event");
				obj2.put( "event", event );
							
				if( obj.get("event").equals( "msg_recv" ) ) {
					
					obj2.put("Dir", "in");
					obj2.put( "To", new String[] { user.name } );
					
					DBCursor csrUser = db.getCollection("users").find( new BasicDBObject("_id", obj2.get("SenderID")) ); 
					if( csrUser.hasNext() )
						obj2.put( "From", (String) csrUser.next().get("username") );
					
					DBCursor csrParent = db.getCollection("eqs").find( new BasicDBObject( "_id", obj2.get("ParentId") ) );
					 
					 if( csrParent.hasNext() )
						 obj2.put( "parentEvt", csrParent.next() );
				}
				
				/* check if entry belongs to general or user specific list */
				if( user != null && obj.get("user").equals( user.objId ) ) {
					ulist.add( obj2 );
				} else {
					mlist.add( obj2 );
				}
				
				/* update timestamp */
				/* TODO: this is just a temporary solution, because progress events could be delivered multiple times */
				if( delay <= 0 || event.equals( "new" ) ) {
					if( first ) {
						timestamp = (Date) obj.get( "timestamp" );
						first = false;
					}
				}
			}
			
			/* clean up query */
			cursor2.close();
		}
		
		/* clean up query */
		cursor.close();
	
	}
						
	/* create new JSON object that can be used directly within JavaScript */
	JsonObject jsonObj = new JsonObject();
	jsonObj.addProperty( "serverTime", sdf.format( new Date() ) );
	jsonObj.addProperty( "ts", sdf.format( timestamp ) );
	jsonObj.add( "main", gson.toJsonTree( mlist ) );
	jsonObj.add( "user", gson.toJsonTree( ulist ) );
			
	return jsonObj.toString();
 }
    
 @POST
 @Path("/search")
 @Produces(MediaType.APPLICATION_JSON)
 public String search(
		 @Context HttpServletRequest request,
		 @FormParam("text") String text,
		 @CookieParam("server_cookie") String session ) {
 
	 /* check session key and find out if the request comes from an authorized user */
	 User user = signedIn( session );
	 
	 /* create list of DB objects that contains all desired users */
	 BasicDBList users = new BasicDBList();
	
	 for( User curUser: institutions.values() )
		 users.add( new BasicDBObject( "user", curUser.objId ) );
	
	 if( user != null )
		 users.add( new BasicDBObject( "user", user.objId ) );
	 
	 DBCollection coll = db.getCollection("eqs");
	 DBCollection msgColl = db.getCollection("messages_sent");
	 DBCollection recvColl = db.getCollection("messages_received");
	 	 
	 List<DBObject> refinements = coll.find( new BasicDBObject( "id", text ) ).toArray();
	 
	 BasicDBList list = new BasicDBList(); 
	 list.add( new BasicDBObject( "_id", text ) );
	 list.add( new BasicDBObject( "id", text ) );
	 list.add( new BasicDBObject( "root", text ) );
	 list.add( new BasicDBObject( "parent", text ) );
	 
	 for( DBObject obj: refinements ) {
		 String compId = (String) obj.get("_id");
		 list.add( new BasicDBObject( "root", compId ) );
		 list.add( new BasicDBObject( "parent", compId ) );
	 }
	 
	 BasicDBList and = new BasicDBList();
	 and.add( new BasicDBObject( "$or", list ) );
	 and.add( new BasicDBObject( "$or", users ) );
	 
	 BasicDBObject inQuery = new BasicDBObject( "$and", and );
	 
	 BasicDBObject sort = new BasicDBObject("timestamp", -1);
	 sort.put("prop.date", -1);
	 System.out.println(inQuery);
	 DBCursor cursor = coll.find( inQuery ).sort( sort );
	 	 
	 List<DBObject> results = new ArrayList<DBObject>();
	 results.addAll( cursor.toArray() );
	 
	 cursor.close();
	 
	 /* TODO: generalize field names */
	 list = new BasicDBList();
	 list.add( new BasicDBObject( "EventID", text ) );
	 list.add( new BasicDBObject( "ParentId", text ) );
	 
	 for( DBObject obj: refinements ) {
		 String compId = (String) obj.get("_id");
		 list.add( new BasicDBObject( "EventID", compId ) );
		 list.add( new BasicDBObject( "ParentId", compId ) );
	 }
	 	 
	 and = new BasicDBList();
	 and.add( new BasicDBObject( "$or", list ) );
	 and.add( new BasicDBObject( "SenderID", user.objId ) );
	 
	 inQuery = new BasicDBObject( "$and", and );
	 	 	 
	 cursor = msgColl.find( inQuery ).sort( new BasicDBObject("CreatedTime", -1) );
	 
	 for( DBObject obj: cursor ) {

		 obj.put( "kind", "msg" );
		 obj.put( "Dir", "out" );
		 results.add( obj );
	 }
	 
	 cursor.close();
	 
	 and = new BasicDBList();
	 and.add( new BasicDBObject( "$or", list ) );
	 and.add( new BasicDBObject( "ReceiverID", user.objId ) );
	 
	 inQuery = new BasicDBObject( "$and", and );
	 
	 cursor = recvColl.find( inQuery ).sort( new BasicDBObject("CreatedTime", -1) );
	 
	 for( DBObject obj: cursor ) {

		 obj.put( "kind", "msg" );
		 obj.put( "Dir", "in" );
		 results.add( obj );
	 }
	 
	 cursor.close();
	 
	 /* returning only cursor.toArray().toString() makes problems with the date fields */
	 return gson.toJsonTree( results ).toString();
 }
  
 @POST
 @Path("/delete")
 @Produces(MediaType.APPLICATION_JSON)
 public String delete(
		  @Context HttpServletRequest request,
		  @FormParam("id") String id,
		  @FormParam("type") String type,
		  @CookieParam("server_cookie") String session ) {
	 
	 Object[] required = { id };

	 if( ! checkParams( request, required ) )
		 return jsfailure();
	 
	 /* check session key and find out if the request comes from an authorized user */
	 User user = signedIn( session );
	 
	 if( user == null )
		 return jsdenied();
	 
	 DBCollection coll;
	 BasicDBObject inQuery = new BasicDBObject();
	 BasicDBObject fields = new BasicDBObject();
	 
	 if( type != null && type.equals("msg_in") ) {
		 
		 coll = db.getCollection("messages_received");
		 inQuery.put( "ReceiverID", user.objId );
		 inQuery.put( "Message-ID", id );
		 
		 fields.put( "ReceiverID", null );
		 
	 } else if( type != null && type.equals("msg_out") ) {
		 
		 coll = db.getCollection("messages_sent");
		 inQuery.put( "SenderID", user.objId );
		 inQuery.put( "Message-ID", id );
		 
		 fields.put( "SenderID", null );
		 
	 } else {
		 
		 coll = db.getCollection("eqs");
		 inQuery.put( "user", user.objId );
		 inQuery.put( "_id", id );
		 
		 fields.put( "user", null );
	 }
	 
	 fields.put( "olduser", user.objId );
	 
	 //int num = coll.remove( inQuery ).getN();
	 BasicDBObject set = new BasicDBObject( "$set", fields );
	 System.out.println( set );
	 int num = coll.update( inQuery, set ).getN();
	 
	 if( num > 0 )
		 return jssuccess();
	 
	 return jsfailure();
 }
  
 @POST
 @Path("/staticLnk")
 @Produces(MediaType.APPLICATION_JSON)
 public String staticLnk(
		  @Context HttpServletRequest request,
		  @FormParam("id") String id,
		  @FormParam("lon") Double lon,
		  @FormParam("lat") Double lat,
		  @FormParam("zoom") Double zoom,
		  @CookieParam("server_cookie") String session ) {
	 	 
	 Object[] required = { id, lon, lat, zoom };

	 if( ! checkParams( request, required ) )
		 return jsfailure();
	 
	 /* check session key and find out if the request comes from an authorized user */
	 User user = signedIn( session );
	 
	 if( user == null )
		 return jsdenied();
	 
	 /* TODO: check if this id exists and their usage is authorized */
	 String key = static_int( id, lon, lat, zoom, user.objId );
	 
	 BasicDBObject result = new BasicDBObject( "key", key );
	 	 
	 return jssuccess( result );
 }
 
 private String static_int( String id, Double lon, Double lat, Double zoom, Object uid ) {
	 
	 DBCollection coll = db.getCollection("shared_links");
	 BasicDBObject inQuery = new BasicDBObject( "evtid", id );
	 inQuery.put( "lon", lon );
	 inQuery.put( "lat", lat );
	 inQuery.put( "zoom", zoom );
	 inQuery.put( "timestamp", new Date() );
	 inQuery.put( "userid", uid );
	 
	 coll.insert( inQuery );
	 ObjectId objId = (ObjectId) inQuery.get( "_id" );
	 
	 return objId.toString();
 }
 
 private String getIP( HttpServletRequest request ) {
 
	 String ip = request.getHeader("X-FORWARDED-FOR");  
	 if (ip == null)
		 ip = request.getRemoteAddr();
	 
	 return ip;
}
 
 @POST
 @Path("/getShared")
 @Produces(MediaType.APPLICATION_JSON)
 public String getShared(
		  @Context HttpServletRequest request,
		  @FormParam("lnkid") String lnkId,
		  @CookieParam("server_cookie") String session ) {
	 	 
	 Object[] required = { lnkId };

	 if( ! checkParams( request, required ) )
		 return jsfailure();
	 
	 ObjectId objId;
	 
	 try {
		 objId = new ObjectId(lnkId);
	 } catch( IllegalArgumentException e ) {
		 return jsfailure();
	 }
	 
	 DBCollection coll = db.getCollection("shared_links");
	 BasicDBObject inQuery = new BasicDBObject( "_id", objId );
	 
	 DBCursor cursor = coll.find( inQuery );
	 
	 if( ! cursor.hasNext() )
		 return jsfailure();
	 
	 DBObject lnkObj = cursor.next();
	 Object evtId = lnkObj.get("evtid");
	 
	 /* store meta data */
	 User user = signedIn( session );
	 Object userId = null;
	 
	 if( user != null )
		 userId = user.objId;
	 
	 DBObject access = new BasicDBObject( "timestamp", new Date() );
	 access.put( "user", userId );
	 access.put( "ip", getIP(request) );
	 
	 DBObject elem = new BasicDBObject( "access", access );
	 DBObject update = new BasicDBObject( "$push", elem );
	 db.getCollection("shared_links").findAndModify( inQuery, update );
	 
	 cursor.close();
	 	 	 
	 BasicDBObject event = new BasicDBObject( "_id", evtId );
	 
	 cursor = db.getCollection("eqs").find( event );
	 
	 if( ! cursor.hasNext() )
		 return jsfailure();
	 
	 /* needed to preserve the expected date format for JavaScript */
	 /* TODO: dates are really difficult to parse between different languages
	  *       --> we need some consistent way to handle these problems */
	 JsonObject json = new JsonObject();
	 json.add( "pos", gson.toJsonTree( lnkObj ) );
	 json.add( "eq", gson.toJsonTree( cursor.next() ) );
	 
	 cursor.close();
	 
	 return jssuccess( json );
 }
 
 @POST
 @Path("/copyToUser")
 @Produces(MediaType.APPLICATION_JSON)
 public String copyToUser(
		  @Context HttpServletRequest request,
		  @FormParam("srcId") String srcId,
		  @CookieParam("server_cookie") String session ) {
	 
	 Object[] required = { srcId };

	 if( ! checkParams( request, required ) )
		 return jsfailure();
	 
	 User user = signedIn( session );
	 
	 if( user == null )
		 return jsdenied();
	 
	 /* do not copy the event again if there is already one copy for that user */
	 BasicDBObject inQuery = new BasicDBObject( "copied", srcId );
	 inQuery.put( "user", user.objId );
	 DBCursor cursor = db.getCollection("eqs").find( inQuery );
	 
	 if( cursor.hasNext() ) {
		 cursor.close();
		 return jssuccess( new BasicDBObject("msg","Copy already exists.") );
	 }
	 
	 cursor.close();
	 
	 inQuery = new BasicDBObject( "_id", srcId );
	 cursor = db.getCollection("eqs").find( inQuery );
 
	 if( ! cursor.hasNext() )
		 return jsfailure();
	 	 
	 DBObject obj = cursor.next();
	 cursor.close();
	 
	 String id = newRandomId(user.name);
	 obj.put("user", user.objId);
	 obj.put("_id", id );
	 obj.put("id", id );
	 obj.put( "timestamp", new Date() );
	 obj.put( "copied", srcId );
	 
	 db.getCollection("eqs").insert( obj );
	 
	 /* copy TFP results */
	 cursor = db.getCollection("tfp_comp").find( new BasicDBObject( "EventID", srcId ) );
	 for( DBObject res: cursor ) {
		 res.put( "EventID", id );
		 res.removeField( "_id" );
		 db.getCollection("tfp_comp").insert( res );
	 }
	 
	 cursor.close();
	 
	 /* copy isolines */
	 cursor = db.getCollection("results").find( new BasicDBObject( "id", srcId ) );
	 for( DBObject res: cursor ) {
		 res.put( "id", id );
		 res.removeField( "_id" );
		 db.getCollection("results").insert( res );
	 }
	 
	 cursor.close();
	 
	 /* copy wave heights */
	 cursor = db.getCollection("results2").find( new BasicDBObject( "id", srcId ) );
	 for( DBObject res: cursor ) {
		 res.put( "id", id );
		 res.removeField( "_id" );
		 db.getCollection("results2").insert( res );
	 }
	 
	 cursor.close();
	 
	 return jssuccess( new BasicDBObject("msg","Event successfully copied.") );
 }
 
 private List<DBObject> msg( int limit, User user ) {
 	 
	 if( user == null )
		 return null;
	 
	 DBCollection coll = db.getCollection("messages_sent");
	 	 	 
	 BasicDBObject inQuery = new BasicDBObject( "SenderID", user.objId );
	 
	 /* query DB, sort the results by date and limit the number of returned entries */
	 DBCursor cursor = coll.find( inQuery ).sort( new BasicDBObject("CreatedTime", -1) );
	
	 if( limit > 0 )
		cursor = cursor.limit( limit );
	 
	 List<DBObject> result = cursor.toArray();
	 cursor.close();
	 	 
	 inQuery = new BasicDBObject( "ReceiverID", user.objId );
	 coll = db.getCollection("messages_received");
	 cursor = coll.find( inQuery ).sort( new BasicDBObject("CreatedTime", -1) );
	 
	 if( limit > 0 )
		cursor = cursor.limit( limit );
	 
	 for( DBObject obj: cursor ) {
		 
		 DBCursor csrUser = db.getCollection("users").find( new BasicDBObject("_id", obj.get("SenderID")) );
		 		 
		 if( csrUser.hasNext() )
			 obj.put( "From", (String) csrUser.next().get("username") );
		 
		 obj.put( "To", new String[] { user.name } );
		 obj.put( "Dir", "in" );
		 
		 result.add( obj );
	 }
	 	 
	 cursor.close();
	 	 
	 Collections.sort( result, new DateComparator( "CreatedTime", -1 ) );
	 
	 /* add parent event as sub-object because we want to show it on click */
	 for( DBObject msg: result ) {
		 
		 DBCursor csr = db.getCollection("eqs").find( new BasicDBObject( "_id", msg.get("ParentId") ) );
		 
		 if( csr.hasNext() ) {
			 DBObject obj = csr.next();
			 obj.removeField("image");
			 msg.put( "parentEvt", obj );
		 }
	 }
	 
	 return result;
 }
 
 @POST
 @Path("/data_insert_tfp")
 @Produces(MediaType.APPLICATION_JSON)
 public String data_insert_tfp(
		  @Context HttpServletRequest request,
		  @FormParam("inst") String inst,
		  @FormParam("secret") String secret,
		  @FormParam("country") String country,
		  @FormParam("code") String code,
		  @FormParam("lon_real") Double lon_real,
		  @FormParam("lat_real") Double lat_real,
		  @FormParam("lon_sea") Double lon_sea,
		  @FormParam("lat_sea") Double lat_sea,
		  @FormParam("name") String name,
		  @FormParam("desc") String desc,
		  @FormParam("type") String type ) {
	  
	  Object[] required = { inst, secret, country, code, lon_real, lat_real,
			  				lon_sea, lat_sea, name, desc, type };
	  	  	  
	  if( ! checkParams( request, required ) )
		  return jsfailure();
	  	  
	  /* check if we got a valid institution and the correct secret */
	  Inst instObj = institutions.get( inst );
	  if( instObj == null || ! instObj.secret.equals( secret ) )
		  return jsdenied();
	  
	  BasicDBObject tfp = new BasicDBObject();
	  tfp.put( "inst", instObj.objId );
	  tfp.put( "country", country );
	  tfp.put( "code", code );
	  tfp.put( "lon_real", lon_real );
	  tfp.put( "lat_real", lat_real );
	  tfp.put( "lon_sea", lon_sea );
	  tfp.put( "lat_sea", lat_sea );
	  tfp.put( "name", name );
	  tfp.put( "desc", desc );
	  tfp.put( "type", type );
	  	  
	  try {
		  db.getCollection("tfps").insert( tfp );
	  } catch( MongoException ex ) {
		  System.err.println( ex.getMessage() );
	  }
	  	  
	  return jssuccess();
}
 
 /* TODO: split params into tokens and encode them separately */
 public static String sendPost( String url, String params ) {
		
	HttpURLConnection con = null;
	
	try {
		con = (HttpURLConnection) new URL( url ).openConnection();
		con.setRequestMethod("POST");
		con.setDoOutput(true);
		DataOutputStream wr = new DataOutputStream( con.getOutputStream() );
		wr.writeBytes( params );
		wr.flush();
		wr.close();
		
		BufferedReader in = new BufferedReader(
		        new InputStreamReader(con.getInputStream()));
		String inputLine;
		StringBuffer response = new StringBuffer();
 
		while ((inputLine = in.readLine()) != null) {
			response.append(inputLine);
		}
		in.close();
 
		return response.toString();
			
	} catch (IOException e) {
		return null;
	}
}
 
 private Date parseIsoDate( String dateStr ) {
	
	 /* used to convert to desired time format used by MongoDB */
	 SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
	 sdf.setTimeZone( TimeZone.getTimeZone("UTC") );
	 
	 Date date;
	 try {
		  date = sdf.parse( dateStr );
	 } catch (ParseException e) {
		  return null;
	 }
 
	 return date;
 }
 
 private String jssuccess( DBObject obj ) {
	 obj.put( "status", "success" );
	 return obj.toString();
 }
 
 private String jssuccess() {
	 return "{ \"status\": \"success\" }";
 }
 
 private String jsfailure() {
	 return "{ \"status\": \"failure\" }";
 }
 
 private String jsfailure( DBObject obj ) {
	 obj.put( "status", "failure");
	 return obj.toString();
 }
 
 private String jsdenied() {
	 return "{ \"status\": \"denied\" }";
 }
 
 private String jsdenied( DBObject obj ) {
	 obj.put( "status", "denied");
	 return obj.toString();
 }
 
 /* this is nearly the same as 'jssuccess( DBObject obj )' but translates
  * the date objects better for later use in JavaScript */
 private String jssuccess( JsonObject js ) {
	 js.add( "status", gson.toJsonTree("success") );
	 return js.toString();
 }
 
 @POST
 @Path("/getCFCZ")
 @Produces(MediaType.APPLICATION_JSON)
 public String getCFCZ() {
	 	 	 
	 DBCollection coll = db.getCollection("cfcz");
	 DBCursor cursor = coll.find();
	 	 	 
	 return cursor.toArray().toString();
 }
 
}
