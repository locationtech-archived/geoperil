package GeoHazardServices;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PrintStream;

public class SshConnection {

	private Process process;
	
	public PrintStream out;
	public BufferedReader in;
	
	private byte[] buffer;
	
	private String ssh;
	private String dir;
	
	public SshConnection( String user, String host, String dir ) throws IOException {
		
		this.ssh = "ssh " + user + "@" + host;
		this.dir = dir;		
		connect();
	}
	
	public void connect() throws IOException {
		
		File tmp = File.createTempFile("worker", "log");
		System.out.println( ssh + " " + tmp.getAbsolutePath() );
		ProcessBuilder pb = new ProcessBuilder( ssh.split(" ") );
		pb.redirectError( tmp );
		//process = Runtime.getRuntime().exec( ssh );
		process = pb.start();
		
		out = new PrintStream( process.getOutputStream() );
		in = new BufferedReader( new InputStreamReader( process.getInputStream() ) );
						
		buffer = new byte[512*1024];
		
		System.out.println( "cd " + dir );
		out.println( "cd " + dir );
		out.println( "echo '\004'" );
		out.flush();
		
		complete();
	}
	
	public int complete() {
		out.flush();
		try {
			String line;
			while( (line = in.readLine()) != null && ! line.equals("\004") );
		} catch( IOException e ) {
			return 1;
		}
		return 0;
	}
	
	public void close() {
		out.println( "exit" );
		out.flush();
	}

	public void writeFile(String content, String fname) {
		out.println("echo '" + content + "' > " + fname);
		out.flush();
	}
	
	public int copyFile(String src, String dst) {
		/* TODO: '\n' can be important if previous program does not issue a final newline - check this for all cases */
		out.println( "echo '\n\004'" );
		complete();
		out.println( "cat " + src );
		out.println( "echo -n '\004'" );
		out.flush();
		/* Use BufferedInputStream to read file in binary mode! */
		BufferedInputStream bin = new BufferedInputStream( process.getInputStream() );
		try {
			BufferedOutputStream writer = new BufferedOutputStream( new FileOutputStream( dst ) );
			int ret = bin.read( buffer, 0, buffer.length );			
			while( ret > 0 ) {
				if( buffer[ ret - 1 ] == '\004' ) {
					ret -= 1;
					writer.write( buffer, 0, ret );
					break;
				}
				writer.write( buffer, 0, ret );
				ret = bin.read( buffer, 0, buffer.length );
			}
			writer.close();
		} catch(IOException e) {
			e.printStackTrace();
			return 1;
		}
		
		return 0;
	}
}
