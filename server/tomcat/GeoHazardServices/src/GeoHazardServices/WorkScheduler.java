package GeoHazardServices;

import java.util.concurrent.BlockingQueue;
import java.util.concurrent.PriorityBlockingQueue;

public class WorkScheduler implements Runnable {
	
	PriorityBlockingQueue<WorkerThread> workerQueue;
	BlockingQueue<TaskParameter> taskQueue;
	
	public WorkScheduler( BlockingQueue<TaskParameter> taskQueue,
						  PriorityBlockingQueue<WorkerThread> workerQueue ) {
		
		this.workerQueue = workerQueue;
		this.taskQueue = taskQueue;
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
