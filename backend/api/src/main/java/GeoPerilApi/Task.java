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

package GeoPerilApi;

import Misc.User;

public class Task implements Comparable<Task> {
    private static final int STATUS_ERROR = 0;
    private static final int STATUS_WAIT = 1;
    private static final int STATUS_RUN = 2;
    private static final int STATUS_DONE = 3;
    private static final int STATUS_ABORT = 4;

    public String id;
    public int status;
    public User user;

    /* Scheduling. */
    public int[] slots;
    public boolean scheduled;

    public Task() {
        this.status = STATUS_WAIT;
        this.scheduled = false;
        this.setSlots(IScheduler.SLOT_NORMAL);
    }

    public final void setSlots(final int... setSlots) {
        this.slots = setSlots;
    }

    public final synchronized boolean markAsRun() {
        /* Task can only be brought into RUN mode if currently in WAIT mode. */
        return markIf(STATUS_RUN, STATUS_WAIT);
    }

    public final synchronized boolean markAsDone() {
        /* Task can only be brought into DONE mode if currently in RUN mode. */
        return markIf(STATUS_DONE, STATUS_RUN);
    }

    public final synchronized boolean markAsAbort() {
        /* Task can only be brought into ABORT mode if currently either in
         * WAIT or RUN mode. */
        return markIf(STATUS_ABORT, STATUS_WAIT);
    }

    public final synchronized boolean markAsError() {
        this.status = STATUS_ERROR;
        return true;
    }

    public final synchronized boolean markIf(
        final int newStatus,
        final int... curStatus
    ) {
        /* Status will only be updated to 'newStatus' if current status is
         * one of 'curStatus'. */
        for (int stat: curStatus) {
            if (this.status == stat) {
                this.status = newStatus;
                return true;
            }
        }
        return false;
    }

    @Override
    public final int compareTo(final Task o) {
        return 0;
    }
}
