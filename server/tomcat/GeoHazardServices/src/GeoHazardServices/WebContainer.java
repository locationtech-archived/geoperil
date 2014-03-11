package GeoHazardServices;

import org.glassfish.jersey.servlet.ServletContainer;

public class WebContainer extends ServletContainer {

	private static final long serialVersionUID = 1391859986618906302L;
	
	@Override
	public void init() throws javax.servlet.ServletException {
		
		super.init();
		System.out.println("init");
	}

}
