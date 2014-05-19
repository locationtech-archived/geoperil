package GeoHazardServices;

import java.io.IOException;
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
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.mongodb.BasicDBList;
import com.mongodb.BasicDBObject;
import com.mongodb.DB;
import com.mongodb.DBCollection;
import com.mongodb.DBCursor;
import com.mongodb.DBObject;
import com.mongodb.MongoClient;
import com.mongodb.util.Base64Codec;

class User {
	
	public String name;
	public Object objId;
	
	public User( DBObject obj ) {
		
		this.objId = (Object) obj.get( "_id" );
		this.name = (String) obj.get( "username" );
	}
	
}

class Inst extends User {
	
	public String secret;
	
	public Inst( DBObject obj ) {
		
		super( obj );
		this.name = (String) obj.get( "name" );
		this.secret = (String) obj.get( "secret" );
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
  private WorkerThread[] worker;
  private final int numWorker = 6;
  
  private MongoClient mongoClient;
  private DB db;
  private Gson gson;
  
  private Map<String,Inst> institutions;
	
  public Services() {
	  
	  System.out.println("Constructor");
	  queue = new ArrayBlockingQueue<TaskParameter>(capacity);
	  workerQueue = new PriorityBlockingQueue<WorkerThread>(100);
	  
	  worker = new WorkerThread[numWorker];
	  for( int i = 0; i < numWorker; i++ ) {
		  
		  try {
			worker[i] = new WorkerThread( workerQueue, GlobalParameter.workingDir + "/w" + i );
		  } catch (IOException e) {
			  System.err.println("Error: Could not create worker thread.");
			  e.printStackTrace();
			  continue;
		  }
		  
		  if( i < 2 ) {
			  worker[i].setRemote( "sysop", "139.17.3.159", "~/EasyWave/web/worker" + i );
			  worker[i].setHardware("GeForce GTX TITAN GPU");
			  worker[i].setPriority(100);
		  } else {
			  worker[i].setRemote( "worker", "139.17.3.234", "~/EasyWave/web/worker" + i );
			  worker[i].setHardware("Tesla C1060 GPU");
			  worker[i].setPriority(200);
		  }
		  
		  worker[i].start();
	  }
	  
	  new Thread( new WorkScheduler( queue, workerQueue ) ).start();
	  
	  try {
		  
		mongoClient = new MongoClient();
		db = mongoClient.getDB( "easywave" );
		
	  } catch (UnknownHostException e) {
		// TODO Auto-generated catch block
		e.printStackTrace();
	  }
	  	  
	  loadInstitutions();
	  
	  gson = new Gson();
	  
	  Listener.registerService( this );
  }
  
  public void destroy() {
 	
 	 mongoClient.close();
 	
 	 for( int i = 0; i < numWorker; i++ ) {
 		 worker[i].stop();
 	 }
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
    
  @GET
  @Path("/addInst")
  @Produces(MediaType.APPLICATION_JSON)
  public String addInst(
		  @Context HttpServletRequest request,
		  @QueryParam("name") String name,
		  @QueryParam("secret") String secret) {
	  
	  Object[] required = { name, secret };
	  	  
	  /* this is maybe not reliable! */
	  String ip = request.getHeader("X-FORWARDED-FOR");
	  	  
	  /* allow access only from localhost */
	  if( ip == null || ! ip.equals( "127.0.0.1" ) )
		  return jsdenied();
	  	  
	  if( ! checkParams( request, required ) )
		  return jsfailure();
	  
	  DBCollection coll = db.getCollection("institutions");
	  
	  BasicDBObject obj = new BasicDBObject( "name", name );
	  
	  /* check if the institution already exist */
	  if( coll.find( obj ).hasNext() )
		  return jsfailure();
	  
	  obj.put( "secret", secret );
	  
	  Inst inst = new Inst( obj );
	  institutions.put( inst.name, inst );
	  
	  coll.insert( obj );
	  
	  return jssuccess();
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
		  @FormParam("dur") Integer dur) {
	  	  		
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
	  	  	  
	  /* TODO: do we have to set { "process": [] } here? */
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
	
	  /* prepare the simulation for execution */
	  return request( lon, lat, mag, depth, dip, strike, rake, compId.toString(), instObj, dur );
  }

  private String request( double lon, double lat, double mag, double depth, double dip,
		  				 double strike, double rake, String id, User user, int dur ) {
	  	  
	  EQParameter eqp = new EQParameter(lon, lat, mag, depth, dip, strike, rake);
	  TaskParameter task = new TaskParameter( eqp, id, user, dur );
	  		  
	  if( queue.offer( task ) == false ) {
		  System.err.println("Work queue is full");
		  return jsfailure();
	  }
	  	  
	  return jssuccess();
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
	  
	  /* upon here, we assume an authorized user */
	  
	  /* get collection that stores the earthquake entries */
	  DBCollection coll = db.getCollection("eqs");
	  
	  /* create an unique ID that is not already present in the DB */
	  Random rand = new Random();
	  String id;
	  
	  while ( true ) {
		  
		  Integer nr = rand.nextInt( 90000 ) + 10000;
		  id = user.name + nr.toString(); 
		
		  if( coll.find( new BasicDBObject("_id", id) ).count() == 0 )
			  break;
	  }
	  	  	  
	  /* get current timestamp */
	  Date timestamp = new Date();
	  
	  /* create new sub object that stores the properties */
	  BasicDBObject sub = new BasicDBObject();
	  sub.put( "date", timestamp );
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
	  obj.put( "user", user.objId );
	  obj.put( "timestamp", timestamp );
	  obj.put( "process", new ArrayList<>() );
	  obj.put( "prop", sub );
	  obj.put( "root", root );
	  obj.put( "parent", parent );
	  
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
	  return request( lon, lat, mag, depth, dip, strike, rake, id, user, dur );
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
		  @FormParam("parent") String parent ) {
	  
	  Object[] required = { inst, secret, id, name, lon, lat, mag, depth,
			  				dip, strike, rake, dateStr };
	  	  	  
	  if( ! checkParams( request, required ) )
		  return jsfailure();
	  	  
	  /* check if we got a valid institution and the correct secret */
	  Inst instObj = institutions.get( inst );
	  if( instObj == null || ! instObj.secret.equals( secret ) )
		  return jsdenied();
	
	  /* get Date object from date string */
	  Date date = parseIsoDate( dateStr );
	  if( date == null )
		  return jsfailure();
	  
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
	  
	  long refineId = 0;
	  CompId compId = new CompId( instObj.name, id, refineId );
	  
	  /* create new DB object that should be added to the eqs collection */
	  BasicDBObject obj = new BasicDBObject();
	  obj.put( "_id", compId.toString() );
	  obj.put( "id", id );
	  obj.put( "user", instObj.objId );
	  obj.put( "refineId", refineId );
	  obj.put( "timestamp", timestamp );
	  obj.put( "prop", sub );
	  obj.put( "root", root );
	  obj.put( "parent", parent );
	  
	  /* create a new event */
	  BasicDBObject event = new BasicDBObject();
	  event.put( "id", compId.toString() );
	  event.put( "user", instObj.objId );
	  event.put( "timestamp", timestamp );
	  event.put( "event", "new" );
	  	  
	  /* insert object into 'eqs' collection */
	  db.getCollection("eqs").insert( obj );
	  
	  /* insert new event into 'events'-collection */
	  db.getCollection("events").insert( event );
			 
	  return jssuccess( new BasicDBObject( "refineId", refineId ) );
  }
    
  @GET
  @Path("/register")
  @Produces(MediaType.APPLICATION_JSON)
  public String register(
		  @Context HttpServletRequest request,
		  @QueryParam("username") String username,
		  @QueryParam("password") String password,
		  @QueryParam("key") String key ) {
	  
	  /* check if this is an authorized request */
	  if( key == null ||  ! key.equals("Malaga2014") )
		  return "Denied";
	  
	  DBCollection coll = db.getCollection("users");
	  	  
	  if( username == null || password == null || username.length() < 3 || password.length() < 6 )
		  return "Error";
	  	  
	  if( coll.find( new BasicDBObject("username", username) ).count() > 0 )
		  return "Error";
	  
	  MessageDigest sha256;
	  
	  try {
		sha256 = MessageDigest.getInstance("SHA-256");
	  } catch (NoSuchAlgorithmException e) {
		return "Internal error";
	  }
	  
	  byte[] hash = sha256.digest( password.getBytes() );
	  
	  Base64Codec base64Codec = new Base64Codec();
	  
	  BasicDBObject obj = new BasicDBObject();
	  obj.put( "username", username );
	  obj.put( "password", base64Codec.encode( hash ) );
	  obj.put( "session", null );
	  
	  coll.insert( obj );
	  
	  return "Ok";
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
		  
		  BasicDBObject result = new BasicDBObject("status", "success");
		  result.put( "user", getUserObj( user.name ) );
		  
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
	  userObj.put("permissions", obj.get("permissions"));
	  userObj.put("properties", obj.get("properties"));
	  
	  return userObj;
  }
  
  private User signedIn( String session ) {
	  	  
	  if( session == null )
		  return null;
	  
	  DBCollection coll = db.getCollection("users");
	  
	  DBCursor cursor = coll.find( new BasicDBObject("session", session) );
	  DBObject obj;
	  
	  if( cursor.hasNext() ) {
		  
		  /* we have found a valid session key */
		  obj = cursor.next();
		  
		  return new User( obj );
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
		
	ArrayList<User> users = new ArrayList<User>( institutions.values() );
	users.add( user );
	
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
			
			/* check if entry belongs to general or user specific list */
			if( obj.get("user").equals( user.objId ) ) {
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
	
	for( User curUser: institutions.values() )
		users.add( new BasicDBObject( "user", curUser.objId ) );
	
	if( user != null )
		users.add( new BasicDBObject( "user", user.objId ) );
	
	/* return only entries that are older than 'delay' minutes */
	Date upperTimeLimit = new Date( System.currentTimeMillis() - delay * 60 * 1000 );
	
	/* create DB query - search for newer events related to the general list or the user */
	BasicDBObject inQuery = new BasicDBObject();
	inQuery.put( "timestamp", new BasicDBObject( "$gt", timestamp ) );
	inQuery.put( "$or", users );
							
	/* query DB, sort the results by timestamp */
	DBCursor cursor = coll.find( inQuery ).sort( new BasicDBObject("timestamp", -1) );
			
	boolean first = true;
		
	/* walk through the returned entries */
	for( DBObject obj: cursor ) {
		
		/* get corresponding entry from earthquake collection */
		String id = (String) obj.get("id");
		
		BasicDBObject objQuery = new BasicDBObject();
		
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
				obj.put( "To", user.name );
			}
			
			/* check if entry belongs to general or user specific list */
			if( obj.get("user").equals( user.objId ) ) {
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
						
	/* create new JSON object that can be used directly within JavaScript */
	JsonObject jsonObj = new JsonObject();
	jsonObj.addProperty( "ts", sdf.format( timestamp ) );
	jsonObj.add( "main", gson.toJsonTree( mlist ) );
	jsonObj.add( "user", gson.toJsonTree( ulist ) );
		
	return jsonObj.toString();
 }
  
 @GET
 @Path("/getIsolines")
 @Produces(MediaType.APPLICATION_JSON)
 public String getIsolines(
		 @Context HttpServletRequest request,
		 @QueryParam("id") String id, 
		 @QueryParam("arrT") int arrT ) {
	 	 	 
	 DBCollection coll = db.getCollection("results");
	 
	 BasicDBObject inQuery = new BasicDBObject();
	 inQuery.put( "id", id );
	 inQuery.put( "process", 0 );
	 inQuery.put( "arrT", new BasicDBObject( "$gt", arrT ) );
	 	 
	 DBCursor cursor = coll.find( inQuery );
	 
	 return cursor.toArray().toString();
 }
 
 @GET
 @Path("/getWaveHeights")
 @Produces(MediaType.APPLICATION_JSON)
 public String getWaveHeights(
		 @Context HttpServletRequest request,
		 @QueryParam("id") String id ) {
	 
	 ArrayList<DBObject> entries = new ArrayList<DBObject>();
	 
	 DBCollection coll = db.getCollection("results2");
	 
	 BasicDBObject inQuery = new BasicDBObject();
	 inQuery.put( "id", id );
	 inQuery.put( "process", 0 );
	 	 
	 DBCursor cursor = coll.find( inQuery ).sort( new BasicDBObject( "ewh", 1 ) );
	 
	 for( DBObject obj: cursor ) {
		String ewh = (String) obj.get( "ewh" );
		obj.put( "color", GlobalParameter.ewhs.get( ewh ) );
		entries.add( obj );
	 }
		
	 cursor.close();
	 
	 String ret = new Gson().toJson( entries );
	 
	 return ret;
 }	
 
 @GET
 @Path("/getPois")
 @Produces(MediaType.APPLICATION_JSON)
 public String getPois(
		 @Context HttpServletRequest request,
		 @QueryParam("id") String id ) {
	 
	 DBCollection coll = db.getCollection("pois_results");
	 
	 BasicDBObject inQuery = new BasicDBObject("id", id);
	 BasicDBObject filter = new BasicDBObject("_id", 0);
	 DBCursor cursor = coll.find( inQuery, filter );
	 	 
	 return cursor.toArray().toString();
 }
 
 @GET
 @Path("/search")
 @Produces(MediaType.APPLICATION_JSON)
 public String search(
		 @Context HttpServletRequest request,
		 @QueryParam("text") String text ) {
 
	 DBCollection coll = db.getCollection("eqs");
	 DBCollection msgColl = db.getCollection("messages_sent");
	 	 
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
	 
	 BasicDBObject inQuery = new BasicDBObject( "$or", list );
	 
	 BasicDBObject sort = new BasicDBObject("prop.date", -1);
	 sort.put("timestamp", -1);
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
	 	 
	 inQuery = new BasicDBObject( "$or", list );
	 
	 cursor = msgColl.find( inQuery ).sort( new BasicDBObject("CreatedTime", -1) );
	 
	 for( DBObject obj: cursor ) {

		 obj.put( "kind", "msg" );
		 results.add( obj );
	 }
	 
	 /* returning only cursor.toArray().toString() makes problems with the date fields */
	 return gson.toJsonTree( results ).toString();
 }
 
 @POST
 @Path("/data_update")
 @Produces(MediaType.APPLICATION_JSON)
 public String data_update(
		  @Context HttpServletRequest request,
		  @FormParam("inst") String inst,
		  @FormParam("secret") String secret,
		  @FormParam("id") String id,
		  @FormParam("refineId") Long refineId,
		  @FormParam("name") @DefaultValue("Custom") String name,
		  @FormParam("lon") Double lon, 
		  @FormParam("lat") Double lat,
		  @FormParam("mag") Double mag,
		  @FormParam("depth") Double depth,
		  @FormParam("dip") Double dip,
		  @FormParam("strike") Double strike,
		  @FormParam("rake") Double rake,
		  @FormParam("date") String dateStr,
		  @FormParam("sea_area") String sea_area ) {
	
	  Object[] required = { inst, secret, id, name, lon, lat, mag, depth,
							dip, strike, rake, dateStr };

	  if( ! checkParams( request, required ) )
		  return jsfailure();
		
	  /* check if we got a valid institution and the correct secret */
	  Inst instObj = institutions.get( inst );
	  if( instObj == null || ! instObj.secret.equals( secret ) )
		  return jsdenied();
	 	  
	  /* get Date object from date string */
	  Date date = parseIsoDate( dateStr );
	  if( date == null )
		  return jsfailure();
		  
	  /* get earthquake collection */
	  DBCollection coll = db.getCollection("eqs");
	
	  /* TODO: check if given id was already refined - if so, return failure */
	  
	  /* search for given id */
	  BasicDBObject inQuery = new BasicDBObject( "id", id );	  
	  DBCursor cursor = coll.find( inQuery ).sort( new BasicDBObject("refineId", -1) );
	
	  /* return if id not found */
	  if( cursor.count() < 1 )
		  return jsfailure();
	
	  /* get properties of returned entry */
	  BasicDBObject entry = (BasicDBObject) cursor.next();
	
	  /* clean up query */
	  cursor.close();
	  
	  if( refineId == null ) {
	  
	  	refineId = (Long) entry.get( "refineId" );
	  
	  	if( refineId == null ) {
	  		refineId = new Long(0);
	  	}
	  
	  	refineId++;
 	  }
	  
	  /* update entry ID in database by appending deprecated field */
	  BasicDBObject depr = new BasicDBObject( "depr", true );
	  coll.update( entry, new BasicDBObject( "$set", depr ) );
	  	  	  
	  /* get current timestamp */
	  Date timestamp = new Date();
	  	  	  
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

	  CompId compId = new CompId( inst, id, refineId );
	  
	  String root = entry.get("root") == null ? (String) entry.get("_id") : (String) entry.get("root");
	  
	  /* create new DB object that should be added to the earthquake collection */
	  BasicDBObject obj = new BasicDBObject();
	  obj.put( "_id", compId.toString() );
	  obj.put( "id", id );
	  obj.put( "refineId", refineId );
	  obj.put( "user", instObj.objId );
	  obj.put( "timestamp", timestamp );
	  obj.put( "prop", sub );
	  obj.put( "root", root );
	  obj.put( "parent", entry.get("_id") );
	  			  	   
	  /* create a new event */
	  BasicDBObject event = new BasicDBObject();
	  event.put( "id", compId.toString() );
	  event.put( "user", instObj.objId );
	  event.put( "timestamp", timestamp );
	  event.put( "event", "update" );
	  
	  /* insert object into collection */
	  coll.insert( obj );
	  
	  /* insert new event into 'events'-collection */
	  db.getCollection("events").insert( event );

	 return jssuccess( new BasicDBObject( "refineId", refineId ) );
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
	 
	 return result;
 }
 
 private Date parseIsoDate( String dateStr ) {
	
	 /* used to convert to desired time format used by MongoDB */
	 SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
	 sdf.setTimeZone( TimeZone.getTimeZone("UTC") );
	 
	 Date date;
	 try {
		  date = sdf.parse( dateStr );
	 } catch (ParseException e) {
		  e.printStackTrace();
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
 
 private String jsdenied() {
	 return "{ \"status\": \"denied\" }";
 }
 
}
