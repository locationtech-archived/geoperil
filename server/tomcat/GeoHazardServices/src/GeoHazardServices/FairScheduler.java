package GeoHazardServices;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.PriorityBlockingQueue;

public class FairScheduler implements IScheduler {

	class Slot {
		PriorityBlockingQueue<WorkerThread> workerQueue;
		PriorityBlockingQueue<TaskParameter> taskQueue;
		
		public Slot() {
			workerQueue = new PriorityBlockingQueue<WorkerThread>();
			taskQueue = new PriorityBlockingQueue<TaskParameter>();
		}
		
		public boolean hasWork() {
			return workerQueue.size() > 0 && taskQueue.size() > 0;
		}
		
		public void schedule() {
			if( ! hasWork() )
				return;
			/* Take pair of worker and task. */
			TaskParameter task = taskQueue.poll();
			if( ! task.markAsRun() ) {
				/* Task already scheduled. Skip. */
				System.out.println("## Task not in WAIT mode. Skip.");
				schedule();
				return;
			}
			WorkerThread worker = workerQueue.poll();
			worker.putWork( task );
		}
	}
	
	private Map<Integer,Slot> slots;
	private Map<String,TaskParameter> tasks;
	
	public FairScheduler() {
		slots = new HashMap<Integer,Slot>();
		slots.put(SLOT_EXCLUSIVE, new Slot());
		slots.put(SLOT_NORMAL, new Slot());
		tasks = new HashMap<String, TaskParameter>();
	}
	
	public synchronized void submit(TaskParameter task) {
		/* Add task to all slots that are given in the object. */
		/* Called by the web server. */
		tasks.put(task.id, task);
		for( int slot: task.slots) {
			slots.get(slot).taskQueue.offer(task);
		}
		/* Wake up scheduler to check if work became available. */
		notify();
	}
	
	public synchronized void submit(WorkerThread worker) {
		/* Add worker to its assigned slot. */
		/* Called by the workers. */
		slots.get( worker.getSlot() ).workerQueue.offer(worker);
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
	
	public synchronized TaskParameter getTask(String id) {
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
