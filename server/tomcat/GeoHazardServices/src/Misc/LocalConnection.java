package Misc;

import java.io.File;
import java.io.IOException;

public class LocalConnection extends Connection {

	public LocalConnection(String dir) throws IOException {
		super(dir);
		connect();
	}
	
	@Override
	public void connect() throws IOException {
		File tmp = File.createTempFile("worker", "log");
		System.out.println( "sh " + tmp.getAbsolutePath() );
		process = new ProcessBuilder("sh").redirectError( tmp ).start();
		super.connect();
	}
}
