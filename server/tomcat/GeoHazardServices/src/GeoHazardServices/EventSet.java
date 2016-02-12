package GeoHazardServices;

import java.util.ArrayList;
import java.util.List;

public class EventSet {
	public String setid;
	public int size;
	public int total_dur;
	/* Progress accumulated over all events. */
	private Integer overall_progress;
	private List<EQTask> tasks;
	private EQTask last;
	
	public EventSet(String setid, int size, int total_dur) {
		this.setid = setid;
		this.size = size;
		this.total_dur = total_dur;
		this.overall_progress = 0;
		this.tasks = new ArrayList<EQTask>();
	}
	
	public synchronized void addTask(EQTask task) {
		this.tasks.add(task);
	}
	
	public synchronized void setLastTask(EQTask task) {
		this.last = task;
	}
	
	public synchronized boolean isLastTask(EQTask task) {
		return this.last == task;
	}
	
	public List<EQTask> getTasks() {
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
