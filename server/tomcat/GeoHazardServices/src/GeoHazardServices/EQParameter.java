package GeoHazardServices;

import java.util.Date;

public class EQParameter {

	public double lon;
	public double lat;
	/* Either mw or slip, width and length must be specified. */
	public double mw;
	public double slip;
	public double length;
	public double width;
	public double depth;
	public double dip;
	public double strike;
	public double rake;
	public Date date;
			
	public EQParameter( double lon, double lat, double mw, double depth,
						double dip, double strike, double rake, Date date) {
		this.lon = lon;
		this.lat = lat;
		this.mw = mw;
		this.depth = depth;
		this.dip = dip;
		this.strike = strike;
		this.rake = rake;
		this.date = date;
	}
	
	public EQParameter( double lon, double lat, double slip, double length, double width,
						double depth, double dip, double strike, double rake, Date date ) {
		this( lon, lat, 0, depth, dip, strike, rake, date );
		this.slip = slip;
		this.length = length;
		this.width = width;
	}
		
	@Override
	public String toString() {
		return new String( "Longitude: " + lon + " Latitude: " + lat + " Magnitude (mw): " + mw +
						   " Depth: " + depth + " Dip: " + dip + " Strike: " + strike + " Rake: " + rake);
	}
}
