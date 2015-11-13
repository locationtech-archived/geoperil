package GeoHazardServices;

import java.util.ArrayList;
import java.util.List;

public class EventSet {
	public String setid;
	public int size;
	public int total_dur;
	/* Progress accumulated over all events. */
	private Integer overall_progress;
	private List<TaskParameter> tasks;
	
	public EventSet(String setid, int size, int total_dur) {
		this.setid = setid;
		this.size = size;
		this.total_dur = total_dur;
		this.overall_progress = 0;
		this.tasks = new ArrayList<TaskParameter>();
	}
	
	public synchronized void addTask(TaskParameter task) {
		this.tasks.add(task);
	}
	
	public List<TaskParameter> getTasks() {
		return this.tasks;
	}
	
	public int getOverallProgress() {
		return overall_progress;
	}
	
	public float incOverallProgress(int amount) {
		synchronized( overall_progress ) {
			overall_progress += amount;
			return getProgress();
		}
	}
	
	/* Return real progress from 0 - 100. */
	public float getProgress() {
		return (this.overall_progress.floatValue() / (float)this.total_dur) * 100.0f;
	}
}
