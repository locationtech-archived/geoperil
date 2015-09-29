package GeoHazardServices;

public class TaskParameter implements Comparable<TaskParameter> {

	private static final int STATUS_ERROR = 0;
	private static final int STATUS_WAIT = 1;
	private static final int STATUS_RUN = 2;
	private static final int STATUS_DONE = 3;
	private static final int STATUS_ABORT = 4;
	
	public EQParameter eqparams;
	public String id;
	public User user;
	public int duration;
	public int accel;
	public int gridres;
	public int raw;
	public int dt_out;
	public EventSet evtset;
	
	public int status;
	public float progress;
	
	/* Scheduling. */
	public int slots[];
	public boolean scheduled;
	
	public TaskParameter( EQParameter eqp ) {
		this.eqparams = eqp;
		this.status = STATUS_WAIT;
		this.progress = 0;
		this.accel = 1;
		/* Default to a 2 arc-minute grid = 120 arc-seconds. */
		this.gridres = 120;
		this.raw = 0;
		this.dt_out = 10;
		this.evtset = null;
		this.setSlots(IScheduler.SLOT_NORMAL);
		this.scheduled = false;
	}
	
	public TaskParameter( EQParameter eqp, String id, User user, int duration, int accel ) {
		this( eqp );
		this.id = id;
		this.user = user;
		this.duration = duration;
		this.accel = accel;
	}
	
	public TaskParameter( EQParameter eqp, String id, User user, int duration, int accel, Integer gridres ) {
		this(eqp, id, user, duration, accel);
		if( gridres != null )
			this.gridres = gridres;
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
	public int compareTo(TaskParameter o) {
		return 0;
	}
}
