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

import java.util.ArrayList;
import java.util.List;

public final class EventSet {
    public String setid;
    public int size;
    public int total_dur;
    /* Progress accumulated over all events. */
    private Integer overall_progress;
    private List<EQTask> tasks;
    private EQTask last;

    private final float calcPercent = 100.0f;

    public EventSet(
        final String evsetid,
        final int evsize,
        final int evtotaldur
    ) {
        this.setid = evsetid;
        this.size = evsize;
        this.total_dur = evtotaldur;
        this.overall_progress = 0;
        this.tasks = new ArrayList<EQTask>();
    }

    public synchronized void addTask(final EQTask task) {
        this.tasks.add(task);
    }

    public synchronized void setLastTask(final EQTask task) {
        this.last = task;
    }

    public synchronized boolean isLastTask(final EQTask task) {
        return this.last == task;
    }

    public List<EQTask> getTasks() {
        return this.tasks;
    }

    public int getOverallProgress() {
        return overall_progress;
    }

    public float incOverallProgress(final int amount) {
        synchronized (overall_progress) {
            overall_progress += amount;
            return getProgress();
        }
    }

    /* Return real progress from 0 - 100. */
    public float getProgress() {
        return (this.overall_progress.floatValue() / (float) this.total_dur)
            * calcPercent;
    }
}
