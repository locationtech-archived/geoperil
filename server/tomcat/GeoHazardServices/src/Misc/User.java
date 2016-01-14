package Misc;

import com.mongodb.DBObject;

public class User {
	
	public String name;
	public Object objId;
	public String inst;
		
	public User( DBObject obj ) {
		this( obj, (DBObject) null );
	}
	
	public User( DBObject obj, String inst ) {
		this( obj );
		this.inst = inst;
	}
	
	public User( DBObject obj, DBObject instObj ) {
		this.objId = (Object) obj.get( "_id" );
		this.name = (String) obj.get( "username" );
		
		if( instObj != null )
			inst = (String) instObj.get( "name" );
	}
}
