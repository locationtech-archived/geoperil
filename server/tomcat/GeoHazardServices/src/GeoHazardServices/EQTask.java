package GeoHazardServices;

import Misc.User;

public class EQTask extends Task {
	
	public EQParameter eqparams;
	public int duration;
	public int accel;
	public int gridres;
	public int raw;
	public int dt_out;
	public EventSet evtset;
	
	public int status;
	public float progress;
	
	public EQTask( EQParameter eqp ) {
		super();
		this.eqparams = eqp;
		this.progress = 0;
		this.accel = 1;
		/* Default to a 2 arc-minute grid = 120 arc-seconds. */
		this.gridres = 120;
		this.raw = 0;
		this.dt_out = 10;
		this.evtset = null;
	}
		
	public EQTask( EQParameter eqp, String id, User user, int duration, int accel ) {
		this( eqp );
		this.id = id;
		this.user = user;
		this.duration = duration;
		this.accel = accel;
	}
	
	public EQTask( EQParameter eqp, String id, User user, int duration, int accel, Integer gridres ) {
		this(eqp, id, user, duration, accel);
		if( gridres != null )
			this.gridres = gridres;
	}
}
