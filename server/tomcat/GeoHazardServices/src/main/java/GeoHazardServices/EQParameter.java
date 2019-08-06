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

public final class EQParameter {

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

    public EQParameter(
        final double eqLon,
        final double eqLat,
        final double eqMw,
        final double eqDepth,
        final double eqDip,
        final double eqStrike,
        final double eqRake,
        final Date eqDate
    ) {
        this.lon = eqLon;
        this.lat = eqLat;
        this.mw = eqMw;
        this.depth = eqDepth;
        this.dip = eqDip;
        this.strike = eqStrike;
        this.rake = eqRake;
        this.date = eqDate;
    }

    public EQParameter(
        final double eqLon,
        final double eqLat,
        final double eqSlip,
        final double eqLength,
        final double eqWidth,
        final double eqDepth,
        final double eqDip,
        final double eqStrike,
        final double eqRake,
        final Date eqDate
    ) {
        this(eqLon, eqLat, 0, eqDepth, eqDip, eqStrike, eqRake, eqDate);
        this.slip = eqSlip;
        this.length = eqLength;
        this.width = eqWidth;
    }

    @Override
    public String toString() {
        return "Longitude: " + lon + " Latitude: " + lat + " Magnitude (mw): "
            + mw + " Depth: " + depth + " Dip: " + dip + " Strike: " + strike
            + " Rake: " + rake;
    }
}
