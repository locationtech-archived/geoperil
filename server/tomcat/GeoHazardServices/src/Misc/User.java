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
