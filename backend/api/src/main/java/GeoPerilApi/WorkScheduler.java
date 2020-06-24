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

import java.util.concurrent.BlockingQueue;
import java.util.concurrent.PriorityBlockingQueue;

public final class WorkScheduler implements IScheduler {
    PriorityBlockingQueue<WorkerThread> workerQueue;
    BlockingQueue<Task> taskQueue;

    WorkScheduler(
        final BlockingQueue<Task> schedTaskQueue,
        final PriorityBlockingQueue<WorkerThread> schedWorkerQueue
    ) {
        this.workerQueue = schedWorkerQueue;
        this.taskQueue = schedTaskQueue;
    }

    public void submit(final WorkerThread worker) {
        this.workerQueue.offer(worker);
    }

    public void submit(final Task task) {
        this.taskQueue.offer(task);
    }

    public Task getTask(final String id) {
        return null;
    }

    @Override
    public void run() {
        WorkerThread worker;
        Task task;

        while (true) {
            try {
                task = taskQueue.take();
                worker = workerQueue.take();
                worker.putWork(task);
            } catch (InterruptedException e) {
                break;
            }
        }
    }
}
