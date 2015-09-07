package GeoHazardServices;

public class TaskParameter {

	public static final int STATUS_ERROR = 0;
	public static final int STATUS_WAIT = 1;
	public static final int STATUS_RUN = 2;
	public static final int STATUS_DONE = 3;
	public static final int STATUS_ABORT = 4;
	
	public EQParameter eqparams;
	public String id;
	public User user;
	public int duration;
	public int accel;
	public int gridres;
	public int raw;
	public int dt_out;
	
	public int status;
	public float progress;
	
	public TaskParameter( EQParameter eqp ) {
		this.eqparams = eqp;
		this.status = STATUS_WAIT;
		this.progress = 0;
		this.accel = 1;
		/* Default to a 2 arc-minute grid = 120 arc-seconds. */
		this.gridres = 120;
		this.raw = 0;
		this.dt_out = 10;
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
}
