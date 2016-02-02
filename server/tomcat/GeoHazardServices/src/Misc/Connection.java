package Misc;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.BufferedReader;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PrintStream;
import java.util.ArrayList;
import java.util.List;

public abstract class Connection {
	
	protected Process process;
	protected PrintStream out;
	protected BufferedReader in;
	protected byte[] buffer;
	protected String dir;
	
	public Connection(String dir) throws IOException {
		this.dir = dir;
	}
	
	public PrintStream out() {
		return out;
	}
	
	public BufferedReader in() {
		return in;
	}
	
	public void connect() throws IOException {
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

	public List<String> runCmds(String ...cmds) throws IOException {
		List<String> lines = new ArrayList<String>();
		for( String cmd: cmds )
			lines.addAll( runCmd(cmd) );
		return lines;
	}
	
	public List<String> runCmd(String cmd) throws IOException {
		List<String> lines = new ArrayList<String>();
		out.println( cmd );
		/* Force newline before \004! */
		out.println( "echo '\n\004'" );
		out.flush();
		String line;
		while( (line = in.readLine()) != null && ! line.equals("\004") ) {			
			lines.add(line);
		}
		/* Remove inserted newline from the result. */
		lines.remove(lines.size() - 1);
		return lines;
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
