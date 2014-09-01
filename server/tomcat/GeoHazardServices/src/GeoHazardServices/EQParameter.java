package GeoHazardServices;

import java.util.Date;

public class EQParameter {

	public double lon;
	public double lat;
	public double mw;
	public double depth;
	public double dip;
	public double strike;
	public double rake;
	public Date date;
			
	public EQParameter( double lon, double lat, double mw, double depth,
						double dip, double strike, double rake, Date date) {
		
		fill( lon, lat, mw, depth, dip, strike, rake, date );
	}
	
	public void fill( double lon, double lat, double mw, double depth,
					  double dip, double strike, double rake, Date date ) {
		
		this.lon = lon;
		this.lat = lat;
		this.mw = mw;
		this.depth = depth;
		this.dip = dip;
		this.strike = strike;
		this.rake = rake;
		this.date = date;
	}
	
	@Override
	public String toString() {
		
		return new String( "Longitude: " + lon + " Latitude: " + lat + " Magnitude (mw): " + mw +
						   " Depth: " + depth + " Dip: " + dip + " Strike: " + strike + " Rake: " + rake);
	}
	
}
