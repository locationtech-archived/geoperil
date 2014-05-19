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
	
	public int status;
	public float progress;
	
	public TaskParameter( EQParameter eqp ) {
		this.eqparams = eqp;
		this.status = STATUS_WAIT;
		this.progress = 0;
	}
	
	public TaskParameter( EQParameter eqp, String id, User user, int duration ) {
		this( eqp );
		this.id = id;
		this.user = user;
		this.duration = duration;
	}
}
