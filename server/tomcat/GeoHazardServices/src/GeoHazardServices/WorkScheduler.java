package GeoHazardServices;

import java.util.concurrent.BlockingQueue;
import java.util.concurrent.PriorityBlockingQueue;

public class WorkScheduler implements IScheduler {
	
	PriorityBlockingQueue<WorkerThread> workerQueue;
	BlockingQueue<TaskParameter> taskQueue;
	
	public WorkScheduler( BlockingQueue<TaskParameter> taskQueue,
						  PriorityBlockingQueue<WorkerThread> workerQueue ) {
		
		this.workerQueue = workerQueue;
		this.taskQueue = taskQueue;
	}
	
	public void submit(WorkerThread worker) {
		this.workerQueue.offer(worker);
	}
	
	public void submit(TaskParameter task) {
		this.taskQueue.offer(task);
	}
	
	public TaskParameter getTask(String id) {
		return null;
	}
	
	@Override
	public void run() {
		
		WorkerThread worker;
		TaskParameter task;
		
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
