package Misc;

import java.util.Date;
import java.util.List;

import com.mongodb.DBObject;

public interface IDataProvider {
	public List<DBObject> fetch(User user, Date maxTimestamp, int limit);
	public List<DBObject> update(User user, Date minTimestamp, Date maxTimestamp);
}
