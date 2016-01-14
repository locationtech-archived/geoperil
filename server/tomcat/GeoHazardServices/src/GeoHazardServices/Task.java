package GeoHazardServices;

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
	public int slots[];
	public boolean scheduled;
	
	public Task() {
		this.status = STATUS_WAIT;
		this.scheduled = false;
		this.setSlots(IScheduler.SLOT_NORMAL);
	}
		
	public void setSlots(int... slots) {
		this.slots = slots;
	}
	
	public synchronized boolean markAsRun() {
		/* Task can only be brought into RUN mode if currently in WAIT mode. */
		return markIf(STATUS_RUN, STATUS_WAIT);
	}
	
	public synchronized boolean markAsDone() {
		/* Task can only be brought into DONE mode if currently in RUN mode. */
		return markIf(STATUS_DONE, STATUS_RUN);
	}
	
	public synchronized boolean markAsAbort() {
		/* Task can only be brought into ABORT mode if currently either in WAIT or RUN mode. */
		return markIf(STATUS_ABORT, STATUS_WAIT);
	}
	
	public synchronized boolean markAsError() {
		this.status = STATUS_ERROR;
		return true;
	}
	
	public synchronized boolean markIf(int newStatus, int... curStatus) {
		/* Status will only be updated to 'newStatus' if current status is one of 'curStatus'. */
		for( int status: curStatus ) {
			if( this.status == status ) {
				this.status = newStatus;
				return true;
			}
		}
		return false;
	}
	
	@Override
	public int compareTo(Task o) {
		return 0;
	}
}
