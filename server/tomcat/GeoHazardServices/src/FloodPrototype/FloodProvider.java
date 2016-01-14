package FloodPrototype;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import com.mongodb.BasicDBList;
import com.mongodb.BasicDBObject;
import com.mongodb.DB;
import com.mongodb.DBCursor;
import com.mongodb.DBObject;

import Misc.IDataProvider;
import Misc.User;

public class FloodProvider implements IDataProvider {
	
	protected DB db;
	
	public FloodProvider(DB db) {
		this.db = db;
	}
	
	@Override
	public List<DBObject> fetch(User user, Date maxTimestamp, int limit) {
		List<DBObject> list = new ArrayList<DBObject>();
		BasicDBObject query = new BasicDBObject("user", user.objId);
		query.append("timestamp", new BasicDBObject("$lte", maxTimestamp));
		DBCursor cursor = db.getCollection("floodsims").find(query).sort( new BasicDBObject("timestamp", -1) ).limit(limit);
		list = cursor.toArray();
		return list;
	}

	@Override
	public List<DBObject> update(User user, Date minTimestamp, Date maxTimestamp) {
		List<DBObject> list = new ArrayList<DBObject>();
		BasicDBList timestamp = new BasicDBList();
		timestamp.add( new BasicDBObject("timestamp", new BasicDBObject( "$gt", minTimestamp )) );
		timestamp.add( new BasicDBObject("timestamp", new BasicDBObject( "$lte", maxTimestamp )) );
		BasicDBObject query = new BasicDBObject("$and", timestamp);
		query.append("class", "flood");
		
		DBCursor cursor = db.getCollection("events").find( query ).sort( new BasicDBObject("timestamp", -1) );
		for( DBObject obj: cursor ) {
			//if( obj.get("event").equals("new") ) {
				BasicDBObject objQuery = new BasicDBObject("_id", obj.get("id"));
				obj.put("data", db.getCollection("floodsims").findOne( objQuery ));
				list.add( obj );
			//}
		}
		
		return list;
	}
}
