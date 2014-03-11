package GeoHazardServices;

import javax.servlet.ServletContextEvent;
import javax.servlet.ServletContextListener;
import javax.servlet.annotation.WebListener;

@WebListener
public class Listener implements ServletContextListener {

	static Services srv = null;
	
	static void registerService( Services srv ) {
		Listener.srv = srv;
	}
	
	@Override
	public void contextDestroyed(ServletContextEvent arg0) {
		if( srv != null )
			srv.destroy();
	}

	@Override
	public void contextInitialized(ServletContextEvent arg0) { }
	
}
