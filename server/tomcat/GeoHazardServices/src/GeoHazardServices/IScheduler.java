package GeoHazardServices;

public interface IScheduler extends Runnable {
	public final int SLOT_EXCLUSIVE = 0;
	public final static int SLOT_NORMAL = 1;
	public void submit(WorkerThread worker);
	public void submit(Task task);
	public Task getTask(String id);
}
