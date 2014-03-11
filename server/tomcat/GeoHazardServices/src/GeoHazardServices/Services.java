package GeoHazardServices;

import java.io.IOException;
import java.net.UnknownHostException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.Random;
import java.util.TimeZone;
import java.util.UUID;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;

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

@Path("")
@Singleton /* Use one global instance of this class instead of creating a new one for each request */
public class Services {

  private BlockingQueue<TaskParameter> queue;
  private final int capacity = 3000;
  private WorkerThread[] worker;
  private final int numWorker = 6;
  
  private MongoClient mongoClient;
  private Gson gson;
	
  public Services() {
	  
	  System.out.println("Constructor");
	  queue = new ArrayBlockingQueue<TaskParameter>(capacity);
	  	  
	  worker = new WorkerThread[numWorker];
	  for( int i = 0; i < numWorker; i++ ) {
		  
		  try {
			worker[i] = new WorkerThread( queue, GlobalParameter.workingDir + "/w" + i );
		  } catch (IOException e) {
			  System.err.println("Error: Could not create worker thread.");
			  e.printStackTrace();
			  continue;
		  }
		  
		  if( i < 2 ) {
			  worker[i].setRemote( "sysop", "139.17.3.159", "~/EasyWave/web/worker" + i );
			  worker[i].setHardware("GeForce GTX TITAN GPU");
		  } else {
			  worker[i].setRemote( "worker", "139.17.3.234", "~/EasyWave/web/worker" + i );
			  worker[i].setHardware("Tesla C1060 GPU");
		  }
		  
		  worker[i].start();
	  }
	  
	  try {
		mongoClient = new MongoClient();
	  } catch (UnknownHostException e) {
		// TODO Auto-generated catch block
		e.printStackTrace();
	  }
	  
	  gson = new Gson();
	  
	  Listener.registerService( this );
  }
  
  public void destroy() {
 	
 	 mongoClient.close();
 	
 	 for( int i = 0; i < numWorker; i++ ) {
 		 worker[i].stop();
 	 }
  }
    	
  @POST
  @Path("/requestById")
  @Produces(MediaType.APPLICATION_JSON)
  public String requestById(
		  @Context HttpServletRequest request,
		  @FormParam("id") String id,
		  @FormParam("key") String key ) {
	  	  		
	  /* TODO: this is just a static workaround until we get a push service from GEOFON */
	  /* check if this is an authorized request */
	  if( key == null || ! key.equals("ABC0123456789def") )
		  return "{ \"status\": \"denied\" }";
	  
	  /* get earthquake collection */
	  DB db = mongoClient.getDB( "easywave" );
	  DBCollection coll = db.getCollection("eqs");
	
	  /* search for given ID */
	  DBCursor cursor = coll.find( new BasicDBObject("_id", id) );
	
	  /* return if ID not found */
	  if( cursor.count() != 1 )
		  return "{ \"status\": \"failure\" }";
	
	  /* get properties of return entry */
	  BasicDBObject entry = (BasicDBObject) cursor.next();
	  BasicDBObject prop = (BasicDBObject) entry.get("prop");
	
	  /* clean up query */
	  cursor.close();
	  
	  /* get timestamp to ensure consistency */
	  Date timestamp = entry.getDate( "timestamp" );
	  
	  /* create a new event */
	  BasicDBObject event = new BasicDBObject();
	  event.put( "id", id );
	  event.put( "user", "gfz" );
	  event.put( "timestamp", timestamp );
	  event.put( "event", "new" );
	  
	  /* insert new event into 'events'-collection */
	  db.getCollection("events").insert( event );
	  
	  /* extract properties to pass them to the request method */
	  double lat = prop.getDouble("latitude");
	  double lon = prop.getDouble("longitude");
	  double mag = prop.getDouble("magnitude");
	  double dip = prop.getDouble("dip");
	  double strike = prop.getDouble("strike");
	  double rake = prop.getDouble("rake");
	  double depth = prop.getDouble("depth");
	
	  /* prepare the simulation for execution */
	  return request( lon, lat, mag, depth, dip, strike, rake, id, "gfz", 180 );
  }

  public String request( double lon, double lat, double mag, double depth, double dip,
		  				 double strike, double rake, String id, String user, int dur ) {
	  	  
	  EQParameter eqp = new EQParameter(lon, lat, mag, depth, dip, strike, rake);
	  TaskParameter task = new TaskParameter( eqp, id, user, dur );
	  		  
	  if( queue.offer( task ) == false ) {
		  System.err.println("Work queue is full");
		  return "{ \"status\": \"failure\" }";
	  }
	  	  
	  /* TODO: id is jabc specific */
	  System.out.println( "{ \"status\": \"success\", \"id\": "+ id + " }" );
	  return "{ \"status\": \"success\", \"id\": "+ id + " }";
  }
    
  /*** TODO: added for jabc - please do not change! ***/
  private String getVirtualSession( String username, String password ) {
	  	  	 	  
	  if( username == null || password == null || username.equals("") || password.equals("") )
		  return null;
	  	  	 	  	  	  
	  DB db = mongoClient.getDB( "easywave" );
	  DBCollection coll = db.getCollection("users");
	  	  
	  DBCursor cursor = coll.find( new BasicDBObject("username", username) );
	  DBObject obj;
	  
	  if( cursor.hasNext() ) {
		  		  
		  obj = cursor.next();
		  String hash = (String) obj.get( "password" );
		  UUID session = (UUID) obj.get( "session" );
		  
		  MessageDigest sha256;
		  
		  try {
			sha256 = MessageDigest.getInstance("SHA-256");
		  } catch (NoSuchAlgorithmException e) {
			return null;
		  }
		  
		  Base64Codec base64Codec = new Base64Codec();
		  		  
		  if( hash.equals( base64Codec.encode( sha256.digest( password.getBytes() ) ) ) ) {
			  
			  if( session == null ) {
				  session = getSessionKey();
				  obj.put("session", session);
				  coll.update( new BasicDBObject("username", username), obj );
			  }
			  
			  return session.toString();
		  }
	  }
	  
	  return null;
  }
  
  @GET
  @Path("/simulate")
  @Produces(MediaType.APPLICATION_JSON)
  public String simulate(
		  @Context HttpServletRequest request,
		  @Context HttpServletResponse response,
		  @QueryParam("user") String user,
		  @QueryParam("password") String password,
		  @QueryParam("lon") double lon, 
		  @QueryParam("lat") double lat,
		  @QueryParam("mag") double mag,
		  @QueryParam("depth") double depth,
		  @QueryParam("dip") double dip,
		  @QueryParam("strike") double strike,
		  @QueryParam("rake") double rake,
		  @QueryParam("dur") int dur ) {
	  	  
	  String session = getVirtualSession( user, password );
	  
	  return compute( request, "Custom", lon, lat, mag, depth, dip, strike, rake, dur, session );
  }
  
  @GET
  @Path("/progress")
  @Produces(MediaType.APPLICATION_JSON)
  public String progress(
		  @QueryParam("id") String id ) {
	  
	  DB db = mongoClient.getDB( "easywave" );
	  DBCollection coll = db.getCollection("events");
	
	  BasicDBObject inQuery = new BasicDBObject();
	  inQuery.put( "id", id );
	  inQuery.put( "event", "progress" );
	  
	  BasicDBObject filter = new BasicDBObject();
	  filter.put( "_id", 0 );
	  filter.put( "progress", 1 );
	  
	  DBCursor cursor = coll.find( inQuery, filter );
 
	  if( cursor.count() == 0 )
		  return "{ \"progress\": 0 }";
 		 
	  return gson.toJson( cursor.next() );
  }
		  
  /****************************/
  
  @POST
  @Path("/compute")
  @Produces(MediaType.APPLICATION_JSON)
  public String compute(
		  @Context HttpServletRequest request,
		  @FormParam("name") @DefaultValue("Custom") String name,
		  @FormParam("lon") double lon, 
		  @FormParam("lat") double lat,
		  @FormParam("mag") double mag,
		  @FormParam("depth") double depth,
		  @FormParam("dip") double dip,
		  @FormParam("strike") double strike,
		  @FormParam("rake") double rake,
		  @FormParam("dur") int dur,
		  @CookieParam("server_cookie") String sess) {
	  	  
	  /* only privileged users are allowed to compute own scenarios - check for valid session */
	  if( sess == null )
		  return "{ \"status\": \"denied\" }";
	  
	  /* try to convert session to UUID */
	  UUID session = null;
	  
	  try {
		  session = UUID.fromString( sess );
	  } catch( IllegalArgumentException e ) {	  
		  return "{ \"status\": \"denied\" }";
	  }
	  
	  /* check if session is valid and if the user is logged in */
	  String user = signedIn( session );
	  
	  if( user == null )
		  return "{ \"status\": \"denied\" }";
	  
	  /* upon here, we assume an authorized user */
	  
	  /* get collection that stores the earthquake entries */
	  DB db = mongoClient.getDB( "easywave" );
	  DBCollection coll = db.getCollection("eqs");
	  
	  /* create an unique ID that is not already present in the DB */
	  Random rand = new Random();
	  String id;
	  
	  while ( true ) {
		  
		  Integer nr = rand.nextInt( 90000 ) + 10000;
		  id = user + nr.toString(); 
		
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
	  obj.put( "user", user );
	  obj.put( "timestamp", timestamp );
	  obj.put( "process", new ArrayList<>() );
	  obj.put( "prop", sub );
	  
	  /* insert object into collection */
	  coll.insert( obj );
	  
	  /* create a new event */
	  BasicDBObject event = new BasicDBObject();
	  event.put( "id", id );
	  event.put( "user", user );
	  event.put( "timestamp", timestamp );
	  event.put( "event", "new" );
	  
	  /* insert new event into 'events'-collection */
	  db.getCollection("events").insert( event );
	  
	  /* start request */
	  return request( lon, lat, mag, depth, dip, strike, rake, id, user, dur );
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
	  
	  DB db = mongoClient.getDB( "easywave" );
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
		  return "{ \"status\": \"failure\" }";
	  	  	 	  	  	  
	  DB db = mongoClient.getDB( "easywave" );
	  DBCollection coll = db.getCollection("users");
	  	  
	  DBCursor cursor = coll.find( new BasicDBObject("username", username) );
	  DBObject obj;
	  
	  if( cursor.hasNext() ) {
		  		  
		  obj = cursor.next();
		  String hash = (String) obj.get( "password" );
		  UUID session = (UUID) obj.get( "session" );
		  
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

			  sessionCookie.setValue( session.toString() );
			  response.addCookie( sessionCookie );
			  
			  return "{ \"status\": \"success\" }";
		  }
	  }
	  
	  return "{ \"status\": \"failure\" }";
  }
  
  @POST
  @Path("/signout")
  @Produces(MediaType.APPLICATION_JSON)
  public String signout(
		  @Context HttpServletRequest request,
		  @Context HttpServletResponse response,
		  @FormParam("username") String username,
		  @CookieParam("server_cookie") String sessionCockie ) {
	  
	  if( username == null || username.equals("") || sessionCockie == null )
		  return "{ \"status\": \"failure\" }";
		  
	  UUID session = null;
	  try {
		  session = UUID.fromString( sessionCockie );
	  } catch( IllegalArgumentException e ) {
		  return "{ \"status\": \"failure\" }";
	  }
	  
	  DB db = mongoClient.getDB( "easywave" );
	  DBCollection coll = db.getCollection("users");
	  
	  DBCursor cursor = coll.find( new BasicDBObject("username", username) );
	  DBObject obj;
	  
	  if( cursor.hasNext() ) {
		
		  obj = cursor.next();
		  
		  if( session.equals( (UUID) obj.get( "session" ) ) ) {
			  
			  obj.put("session", null);
			  coll.update( new BasicDBObject("username", username), obj );
			  
			  Cookie sessionCookie = new Cookie("server_cookie", "");
			  sessionCookie.setPath("/");
			  sessionCookie.setMaxAge( 0 );
			  response.addCookie( sessionCookie );
			  
			  return "{ \"status\": \"success\" }";
		  }
	  }
	  	  
	  return "{ \"status\": \"failure\" }";
  }
		  
  @POST
  @Path("/session")
  @Produces(MediaType.APPLICATION_JSON)
  public String session(
		  @Context HttpServletRequest request,
		  @Context HttpServletResponse response,
		  @CookieParam("server_cookie") String sessionCockie ) {
	  
	  if( sessionCockie == null )
		  return "{ \"status\": \"failure\" }";
	  
	  UUID session = null;
	  try {
		  session = UUID.fromString( sessionCockie );
	  } catch( IllegalArgumentException e ) {
		  return "{ \"status\": \"failure\" }";
	  }
	  
	  String user = signedIn( session );
	  if( user != null )
		  return "{ \"status\": \"success\", \"username\": \"" + user + "\" }";
	  
	  return "{ \"status\": \"failure\" }";
  }
  
  private String signedIn( UUID session ) {
	  	  
	  if( session == null )
		  return null;
	  
	  DB db = mongoClient.getDB( "easywave" );
	  DBCollection coll = db.getCollection("users");
	  
	  DBCursor cursor = coll.find( new BasicDBObject("session", session) );
	  DBObject obj;
	  
	  if( cursor.hasNext() ) {
		  
		  /* we have found a valid session key */
		  obj = cursor.next();
		  
		  return (String)obj.get("username");
	  }
	  
	  return null;
  }
    
  public UUID getSessionKey() {
	  
	  return UUID.randomUUID();
  }
        
  private UUID getSessionUUID( String sessionCockie ) {
	  
	  UUID session = null;
	  
	  if( sessionCockie == null )
		  return null;
	  
	  try {
		  session = UUID.fromString( sessionCockie );
	  } catch( IllegalArgumentException e ) {
		  return null;
	  }
	  
	  return session;
  }
  
 @POST
 @Path("/fetch")
 @Produces(MediaType.APPLICATION_JSON)
 public String fetch(
		  @Context HttpServletRequest request,
		  @FormParam("limit") int limit,
		  @FormParam("undersea") @DefaultValue("false") boolean undersea,
		  @CookieParam("server_cookie") String sessionCookie) {
	 
	/* check session key and find out if the request comes from an authorized user */
	UUID session = getSessionUUID( sessionCookie );
	String user = signedIn( session ); /* returns null if user is not logged in */
	 	
	/* set default limit */
	if( limit <= 0 ) limit = 10;
			
	/* create lists for generals and user specific earthquake entries */
	ArrayList<DBObject> mlist = new ArrayList<DBObject>();
	ArrayList<DBObject> ulist = new ArrayList<DBObject>();
	
	/* we want all entries since the beginning of time */
	Date maxTimestamp = new Date(0);
	
	/* used to convert to desired time format used by MongoDB */
	SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
	sdf.setTimeZone( TimeZone.getTimeZone("UTC") );
			
	/* select database and collection which contain the earthquake entries */
	DB db = mongoClient.getDB( "easywave" );
	DBCollection coll = db.getCollection("eqs");
		
	String users[] = { "gfz", user }; 
	
	/* get earthquakes for each of the given users */
	for( int i = 0; i < users.length; i++ ) {
	
		/* create DB query */
		BasicDBObject inQuery = new BasicDBObject( "user", users[i] );
		
		if( undersea )
			inQuery.append( "prop.sea_area", new BasicDBObject( "$ne", null ) );
		
		/* query DB, sort the results by date and limit the number of returned entries */
		DBCursor cursor = coll.find( inQuery ).sort( new BasicDBObject("prop.date", -1) ).limit(limit);
					
		/* walk through the returned entries */
		for( DBObject obj: cursor ) {
			
			/* check if entry belongs to general or user specific list */
			if( obj.get("user").equals("gfz") ) {
				mlist.add( obj );
			} else {
				ulist.add( obj );
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
	jsonObj.addProperty("ts", sdf.format( maxTimestamp ) );
	jsonObj.add( "main", gson.toJsonTree( mlist ) );	
	jsonObj.add( "user", gson.toJsonTree( ulist ) );
				
	return jsonObj.toString();
 }
 	
 @POST
 @Path("/update")
 @Produces(MediaType.APPLICATION_JSON)
 public String update(
		 @Context HttpServletRequest request,
		 @FormParam("ts") String ts,
		 @CookieParam("server_cookie") String sessionCookie ) {
			 
	/* check session key and find out if the request comes from an authorized user */
	UUID session = getSessionUUID( sessionCookie );
	String user = signedIn( session );
	 
	/* create lists for generals and user specific earthquake entries */
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
		 
	/* select database and collection which contain the events */
	DB db = mongoClient.getDB( "easywave" );
	DBCollection coll = db.getCollection("events");
			
	/* create list of DB objects that contains all desired users */
	BasicDBList users = new BasicDBList();
	users.add( new BasicDBObject( "user", "gfz" ) );
	
	if( user != null )
		users.add( new BasicDBObject( "user", user ) );
	
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
		DBCursor cursor2 = db.getCollection("eqs").find( new BasicDBObject( "_id", id ) );
		
		/*  */
		if( cursor2.hasNext() ) {
			
			/* add event type to entry */
			DBObject obj2 = cursor2.next();			
			obj2.put( "event", (String) obj.get("event") );

			/* check if entry belongs to general or user specific list */
			if( obj.get("user").toString().equals("gfz") ) {
				mlist.add( obj2 );
			} else {
				ulist.add( obj2 );
			}
			
		} else {
			System.err.println("Could not find 'id' in earthquake collection.");
		}
		
		/* clean up query */
		cursor2.close();

		/* update timestamp */
		if( first ) {
			timestamp = (Date) obj.get( "timestamp" );
			first = false;
		}
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
	 
	 ArrayList<DBObject> entries = new ArrayList<DBObject>();
	 
	 DB db = mongoClient.getDB( "easywave" );
	 DBCollection coll = db.getCollection("results");
	 
	 BasicDBObject inQuery = new BasicDBObject();
	 inQuery.put( "id", id );
	 inQuery.put( "process", 0 );
	 inQuery.put( "arrT", new BasicDBObject( "$gt", arrT ) );
	 	 
	 DBCursor cursor = coll.find( inQuery );
	 
	 for( DBObject obj: cursor ) {
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
	 
	 DB db = mongoClient.getDB( "easywave" );
	 DBCollection coll = db.getCollection("pois_results");
	 
	 BasicDBObject inQuery = new BasicDBObject("id", id);
	 BasicDBObject filter = new BasicDBObject("_id", 0);
	 DBCursor cursor = coll.find( inQuery, filter );
	 	 
	 return cursor.toArray().toString();
 }
 
}
