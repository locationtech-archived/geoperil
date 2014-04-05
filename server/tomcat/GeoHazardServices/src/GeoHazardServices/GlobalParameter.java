package GeoHazardServices;

import java.util.HashMap;

public class GlobalParameter {

	public static final String workingDir = "/home/sysop/EasyWave/web/";
	//public static final String workingDir = "/home/hannes/EasyWave/web/";
	public static final String easyWave = "/home/hannes/EasyWave/cpu/branches/web/EasyWave";
		
	public static final HashMap<String, String> ewhs = new HashMap<String, String>();
    static {
    	ewhs.put( "0.3", "#fdfd01" );
    	ewhs.put( "0.5", "#ff6100" );
    	ewhs.put( "1", "#f50000" );
    	ewhs.put( "2", "#ad0000" );
    	ewhs.put( "5", "#fe00fa" );
    	ewhs.put( "10", "#5c005c" );
    }
	
}
