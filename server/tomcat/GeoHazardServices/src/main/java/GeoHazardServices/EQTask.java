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

package GeoHazardServices;

import Misc.User;

public class EQTask extends Task {
		
	public class BoundingBox {
		public double lonMin;
		public double lonMax;
		public double latMin;
		public double latMax;
		
		public BoundingBox(double lonMin, double lonMax, double latMin, double latMax) {
			this.lonMin = lonMin;
			this.lonMax = lonMax;
			this.latMin = latMin;
			this.latMax = latMax;
		}
	}
	
	public EQParameter eqparams;
	public int duration;
	public int accel;
	public int gridres;
	public int raw;
	public int dt_out;
	public EventSet evtset;
	public String algo;
	public BoundingBox bbox;
	
	public int status;
	public float progress;
	public float calcTime;
	public float prevCalcTime;
	public int curSimTime;
	public int prevSimTime;
	
	public EQTask( EQParameter eqp ) {
		super();
		this.eqparams = eqp;
		this.progress = 0;
		this.accel = 1;
		/* Default to a 2 arc-minute grid = 120 arc-seconds. */
		this.gridres = 120;
		this.raw = 0;
		this.dt_out = 10;
		this.evtset = null;
	}
		
	public EQTask( EQParameter eqp, String id, User user, int duration, int accel ) {
		this( eqp );
		this.id = id;
		this.user = user;
		this.duration = duration;
		this.accel = accel;
	}
	
	public EQTask( EQParameter eqp, String id, User user, int duration, int accel, Integer gridres ) {
		this(eqp, id, user, duration, accel);
		if( gridres != null )
			this.gridres = gridres;
	}
	
	public void setBoundingBox(double lonMin, double lonMax, double latMin, double latMax) {
		this.bbox = new BoundingBox(lonMin, lonMax, latMin, latMax);
	}
}
