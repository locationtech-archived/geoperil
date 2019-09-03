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

public final class EQTask extends Task {

    public class BoundingBox {
        public double lonMin;
        public double lonMax;
        public double latMin;
        public double latMax;

        public BoundingBox(
            final double bboxLonMin,
            final double bboxLonMax,
            final double bboxLatMin,
            final double bboxLatMax
        ) {
            this.lonMin = bboxLonMin;
            this.lonMax = bboxLonMax;
            this.latMin = bboxLatMin;
            this.latMax = bboxLatMax;
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

    /* Default to a 2 arc-minute grid = 120 arc-seconds. */
    private final int defaultGridres = 120;
    private final int defaultDtOut = 10;

    public EQTask(final EQParameter eqp) {
        super();
        this.eqparams = eqp;
        this.progress = 0;
        this.accel = 1;
        this.gridres = defaultGridres;
        this.raw = 0;
        this.dt_out = defaultDtOut;
        this.evtset = null;
    }

    public EQTask(
        final EQParameter eqp,
        final String id,
        final User user,
        final int taskDuration,
        final int taskAccel
    ) {
        this(eqp);
        this.id = id;
        this.user = user;
        this.duration = taskDuration;
        this.accel = taskAccel;
    }

    public EQTask(
        final EQParameter eqp,
        final String id,
        final User user,
        final int taskDuration,
        final int taskAccel,
        final Integer taskGridres
    ) {
        this(eqp, id, user, taskDuration, taskAccel);
        if (taskGridres != null) {
            this.gridres = taskGridres;
        }
    }

    public void setBoundingBox(
        final double lonMin,
        final double lonMax,
        final double latMin,
        final double latMax
    ) {
        this.bbox = new BoundingBox(lonMin, lonMax, latMin, latMax);
    }

    @Override
    public String toString() {
        return "EQTask [accel=" + accel + ", algo=" + algo + ", bbox=" + bbox
            + ", calcTime=" + calcTime + ", curSimTime=" + curSimTime
            + ", defaultDtOut=" + defaultDtOut + ", defaultGridres="
            + defaultGridres + ", dt_out=" + dt_out + ", duration="
            + duration + ", eqparams=" + eqparams + ", evtset=" + evtset
            + ", gridres=" + gridres + ", prevCalcTime=" + prevCalcTime
            + ", prevSimTime=" + prevSimTime + ", progress=" + progress
            + ", raw=" + raw + ", status=" + status + "]";
    }
}
