package FloodPrototype;

import java.util.List;

import GeoHazardServices.Task;
import Misc.User;

public class FloodTask extends Task {
	
	private List<Location> locations;
	
	public FloodTask(String id, User user, List<Location> locations) {
		this.id = id;
		this.user = user;
		this.locations = locations;
	}
	
	public List<Location> getLocations() {
		return this.locations; 
	}
}
