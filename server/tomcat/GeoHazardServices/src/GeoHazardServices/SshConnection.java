package GeoHazardServices;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PrintStream;

public class SshConnection {

	private Process process;
	
	public PrintStream out;
	public BufferedReader in;
	
	public char[] buffer;
	
	private String ssh;
	private String dir;
	
	public SshConnection( String user, String host, String dir ) throws IOException {
		
		this.ssh = "ssh " + user + "@" + host;
		this.dir = dir;
		connect();
	}
	
	public void connect() throws IOException {
		
		System.out.println( ssh );
		process = Runtime.getRuntime().exec( ssh );
		
		out = new PrintStream( process.getOutputStream() );
		in = new BufferedReader( new InputStreamReader( process.getInputStream() ) );
						
		buffer = new char[512*1024];
		
		System.out.println( "cd " + dir );
		out.println( "cd " + dir );
		out.println( "echo '\004'" );
		out.flush();
		
		String line;
		while( (line = in.readLine()) != null && ! line.equals("\004") );
	}
	
	public void close() {
		out.println( "exit" );
		out.flush();
	}

}
