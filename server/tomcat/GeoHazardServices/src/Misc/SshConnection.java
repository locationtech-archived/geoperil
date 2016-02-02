package Misc;

import java.io.File;
import java.io.IOException;

public class SshConnection extends Connection {
	
	private String ssh;
	
	public SshConnection(String user, String host, String dir) throws IOException {
		super(dir);
		this.ssh = "ssh " + user + "@" + host;
		connect();
	}
	
	@Override
	public void connect() throws IOException {
		File tmp = File.createTempFile("worker", "log");
		System.out.println( "sh " + tmp.getAbsolutePath() );
		process = new ProcessBuilder( ssh.split(" ") ).redirectError( tmp ).start();
		super.connect();
	}
}
