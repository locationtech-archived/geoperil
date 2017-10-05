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

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.PriorityBlockingQueue;

public class FairScheduler implements IScheduler {

	class Slot {
		PriorityBlockingQueue<WorkerThread> workerQueue;
		PriorityBlockingQueue<Task> taskQueue;
		
		public Slot() {
			workerQueue = new PriorityBlockingQueue<WorkerThread>();
			taskQueue = new PriorityBlockingQueue<Task>();
		}
		
		public boolean hasWork() {
			return workerQueue.size() > 0 && taskQueue.size() > 0;
		}
		
		public void schedule() {
			if( ! hasWork() )
				return;
			/* Take pair of worker and task. */
			Task task = taskQueue.poll();
			if( ! task.markAsRun() ) {
				/* Task already scheduled. Skip. */
				System.out.println("## Task " + task.id + " not in WAIT mode. Skip.");
				schedule();
				return;
			}
			WorkerThread worker = workerQueue.poll();
			System.out.println("## Worker " + worker + " gets task " + task.id + " assigned");
			worker.putWork( task );
		}
	}
	
	private Map<Integer,Slot> slots;
	private Map<String,Task> tasks;
	
	public FairScheduler() {
		slots = new HashMap<Integer,Slot>();
		slots.put(SLOT_EXCLUSIVE, new Slot());
		slots.put(SLOT_NORMAL, new Slot());
		slots.put(SLOT_HYSEA, new Slot());
		tasks = new HashMap<String, Task>();
	}
	
	public synchronized void submit(Task task) {
		/* Add task to all slots that are given in the object. */
		/* Called by the web server. */
		tasks.put(task.id, task);
		for( int slot: task.slots) {
			slots.get(slot).taskQueue.offer(task);
			System.out.println("## Added task " + task.id + " to slot " + slot);
		}
		/* Wake up scheduler to check if work became available. */
		notify();
	}
	
	public synchronized void submit(WorkerThread worker) {
		/* Add worker to its assigned slot. */
		/* Called by the workers. */
		slots.get( worker.getSlot() ).workerQueue.offer(worker);
		System.out.println("## Added worker " + worker + " for slot " + worker.getSlot());
		/* Wake up scheduler to check if work became available. */
		notify();
	}
	
	private synchronized void waitForWork() {
		/* Check if a pair of task and worker is available that can be scheduled in the next iteration. */
		/* Called by the scheduler. */
		while( true ) {
			/* Check all slots if work is available. */
			for( Slot slot: slots.values() ) {
				if( slot.hasWork() )
					return;
			}
			try {
				System.out.println("## Scheduler goes to sleep");
				wait();
				System.out.println("## Scheduler continues");
			} catch (InterruptedException e) {
				e.printStackTrace();
				return;
			}
		}
	}
	
	public synchronized Task getTask(String id) {
		return tasks.get(id);
	}
	
	@Override
	public void run() {
		/* Check each slot for readiness. */
		/* Distribute task to worker. */
		while( true ) {
			/* Iterate slots. */
			for( Slot slot: slots.values() ) {
				slot.schedule();
			}
			/* Sleep until new things to schedule become available. */
			waitForWork();
		}
	}

}
