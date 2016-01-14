package GeoHazardServices;

import java.util.concurrent.BlockingQueue;
import java.util.concurrent.PriorityBlockingQueue;

public class WorkScheduler implements IScheduler {
	
	PriorityBlockingQueue<WorkerThread> workerQueue;
	BlockingQueue<Task> taskQueue;
	
	public WorkScheduler( BlockingQueue<Task> taskQueue,
						  PriorityBlockingQueue<WorkerThread> workerQueue ) {
		
		this.workerQueue = workerQueue;
		this.taskQueue = taskQueue;
	}
	
	public void submit(WorkerThread worker) {
		this.workerQueue.offer(worker);
	}
	
	public void submit(Task task) {
		this.taskQueue.offer(task);
	}
	
	public Task getTask(String id) {
		return null;
	}
	
	@Override
	public void run() {
		
		WorkerThread worker;
		Task task;
		
		while( true ) {
			
			try {
				
				task = taskQueue.take();
				worker = workerQueue.take();
				worker.putWork( task );
				
			} catch (InterruptedException e) {
				break;
			}
			
		}

	}

}
