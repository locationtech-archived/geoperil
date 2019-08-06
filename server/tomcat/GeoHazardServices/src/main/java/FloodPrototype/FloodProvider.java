/*
 * GeoPeril - A platform for the computation and web-mapping of hazard specific
 * geospatial data, as well as for serving functionality to handle, share, and
 * communicate threat specific information in a collaborative environment.
 *
 * Copyright (C) 2013 GFZ German Research Centre for Geosciences
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the Licence is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the Licence for the specific language governing permissions and
 * limitations under the Licence.
 *
 * Contributors:
 * Johannes Spazier (GFZ) - initial implementation
 * Sven Reissland (GFZ) - initial implementation
 * Martin Hammitzsch (GFZ) - initial implementation
 */

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

public final class FloodProvider implements IDataProvider {

    protected DB db;

    public FloodProvider(final DB database) {
        this.db = database;
    }

    @Override
    public List<DBObject> fetch(
        final User user,
        final Date maxTimestamp,
        final int limit
    ) {
        List<DBObject> list = new ArrayList<DBObject>();
        BasicDBObject query = new BasicDBObject("user", user.objId);
        query.append("timestamp", new BasicDBObject("$lte", maxTimestamp));
        DBCursor cursor = db.getCollection("floodsims").find(query).sort(
            new BasicDBObject("timestamp", -1)
        ).limit(limit);
        list = cursor.toArray();
        return list;
    }

    @Override
    public List<DBObject> update(
        final User user,
        final Date minTimestamp,
        final Date maxTimestamp
    ) {
        List<DBObject> list = new ArrayList<DBObject>();
        BasicDBList timestamp = new BasicDBList();
        timestamp.add(
            new BasicDBObject(
                "timestamp",
                new BasicDBObject("$gt", minTimestamp)
            )
        );
        timestamp.add(
            new BasicDBObject(
                "timestamp",
                new BasicDBObject("$lte", maxTimestamp)
            )
        );
        BasicDBObject query = new BasicDBObject("$and", timestamp);
        query.append("class", "flood");

        DBCursor cursor = db.getCollection("events")
            .find(query).sort(new BasicDBObject("timestamp", -1));
        for (DBObject obj: cursor) {
            //if( obj.get("event").equals("new") ) {
            BasicDBObject objQuery = new BasicDBObject("_id", obj.get("id"));
            obj.put("data", db.getCollection("floodsims").findOne(objQuery));
            list.add(obj);
            //}
        }

        return list;
    }

    @Override
    public boolean add(final List<DBObject> out, final DBObject obj) {
        if (!"flood".equals(obj.get("class"))) {
            return false;
        }

        BasicDBObject objQuery = new BasicDBObject("_id", obj.get("id"));
        obj.put("data", db.getCollection("floodsims").findOne(objQuery));
        out.add(obj);
        return true;
    }

}
