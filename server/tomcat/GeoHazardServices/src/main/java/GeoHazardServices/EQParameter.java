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

import java.util.Date;

public class EQParameter {

	public double lon;
	public double lat;
	/* Either mw or slip, width and length must be specified. */
	public double mw;
	public double slip;
	public double length;
	public double width;
	public double depth;
	public double dip;
	public double strike;
	public double rake;
	public Date date;

	public EQParameter( double lon, double lat, double mw, double depth,
						double dip, double strike, double rake, Date date) {
		this.lon = lon;
		this.lat = lat;
		this.mw = mw;
		this.depth = depth;
		this.dip = dip;
		this.strike = strike;
		this.rake = rake;
		this.date = date;
	}

	public EQParameter( double lon, double lat, double slip, double length, double width,
						double depth, double dip, double strike, double rake, Date date ) {
		this( lon, lat, 0, depth, dip, strike, rake, date );
		this.slip = slip;
		this.length = length;
		this.width = width;
	}

	@Override
	public String toString() {
		return new String( "Longitude: " + lon + " Latitude: " + lat + " Magnitude (mw): " + mw +
						   " Depth: " + depth + " Dip: " + dip + " Strike: " + strike + " Rake: " + rake);
	}
}
