package Tsunami;

import java.io.File;
import java.io.IOException;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.mongodb.DB;

import GeoHazardServices.EQParameter;
import GeoHazardServices.EQTask;
import Misc.SshConnection;

public class HySeaAdapter extends TsunamiAdapter {

	private final String outfile = "hysea_out";
	private int jobid = 0;
	
	public HySeaAdapter(DB db, SshConnection[] sshCon, File workdir, String hardware) throws IOException {
		super(db, sshCon, workdir, hardware);
	}

	@Override
	protected void writeFault(EQTask task) throws IOException {
		StringBuilder strFault = new StringBuilder();
		EQParameter eqp = task.eqparams;
				
		/* Compute bounding box. */
		double margin = 5.0 * task.duration / (task.gridres / 3600.0) / 1000.0;
		double ulx = eqp.lon - margin;
		double lrx = eqp.lon + margin;
		double uly = Math.min( eqp.lat + margin, 90 );
		double lry = Math.max( eqp.lat - margin, -90 );
		task.setBoundingBox(ulx, lrx, lry, uly);
		System.out.println("BBox: " + ulx + ", " + uly + " - " + lrx + ", " + lry );
		sshCon[0].runCmds(
			String.format(Locale.US, "gdal_translate -projwin %f %f %f %f -of GSBG ../grid_%d.grd range.grd", ulx, uly, lrx, lry, task.gridres),
			String.format("gdal_calc.py -A range.grd --calc=\"-A\" --overwrite --outfile=range.grd")
		);
		
		/* Determine size of grid. */
		int xsize = 0;
		int ysize = 0;
		for( String line: sshCon[0].runCmd("gdalinfo range.grd") ) {
			Matcher matcher = Pattern.compile("Size is (\\d*), (\\d*)").matcher(line);
			if( matcher.find() ) {
				xsize = Integer.valueOf( matcher.group(1) );
				ysize = Integer.valueOf( matcher.group(2) );
			}
		}
		
		/* Translate grid to binary XYZ. */
		sshCon[0].runCmds(
			"gdal_translate -of XYZ range.grd range.xyz.bat",
			"binconvert.exe range.xyz",
			"mv range.xyz_bin.bat range.xyz.bin"
		);
		
		/* Write input file. */
		strFault.append("range\n");
		strFault.append(xsize + "\n");
		strFault.append(ysize + "\n");
		strFault.append("range.xyz.bin\n");
		strFault.append(
			String.format(Locale.US, "1\n%f\n%f\n%f\n%f\n%f\n%f\n%f\n%f\n%f\n%f\n%f\n%f\n%f\n",
				eqp.lon, eqp.lat, eqp.depth, eqp.length, eqp.width, eqp.strike, eqp.dip, eqp.rake, eqp.slip,
				-500.0, 500.0, -500.0, 500.0
			)
		);
		strFault.append(outfile + "\n");
		strFault.append("1\n");
		strFault.append("1\n");
		strFault.append("1\n");
		strFault.append("1\n");
		strFault.append((task.duration * 60 + 2) + "\n");
		strFault.append(task.duration * 60 + "\n"); /* TODO */
		strFault.append("0 # readFromFile\n"); /* Change for TFPs */
		strFault.append("0.5\n");
		strFault.append("5e-3\n");
		strFault.append("20\n");
		strFault.append("0.2\n");
		strFault.append("0.03\n");
		strFault.append("100\n");
		strFault.append("100000\n");
		strFault.append("1000\n");
		
		sshCon[0].writeFile(strFault.toString(), "fault.inp");
	}

	@Override
	protected void writeTFPs(EQTask task) throws IOException {
		// TODO Auto-generated method stub
	}

	@Override
	protected int simulate(EQTask task) throws IOException {
		jobid = 0;
		for( String line: sshCon[0].runCmd("qsub ../run_hysea.sh -d `pwd`") ) {
			Matcher matcher = Pattern.compile("(\\d*)\\.atlantico.local").matcher(line);
			if( matcher.find() )
				jobid = Integer.valueOf( matcher.group(1) );
		}
		if( jobid == 0 ) return -1;
		
		initialProgress(task);
		
		long start = System.nanoTime();
		boolean finished = false;
		int lnr = 1;
		while( ! finished ) {
			boolean changed = false;
			for( String line: sshCon[0].runCmd("tail -n +" + lnr + " ~/HySEA.o" + jobid) ) {
				Matcher matcher = Pattern.compile("Time = (\\d+\\.?\\d*) sec").matcher(line);
				if( matcher.find() ) {
					task.progress = Math.min( Float.valueOf( matcher.group(1) ) / (task.duration * 60.0f), 1.0f) * 100.0f;
					task.calcTime = (System.nanoTime() - start) / 1000000.0f;
					changed = true;
				}
				if( line.startsWith("Runtime") )
					finished = true;
				lnr++;
			}
			if( changed ) {
				updateProgress(task);
				System.out.println(task.progress);
			}
			try {
				Thread.sleep(5000);
			} catch (InterruptedException e) {
				Thread.currentThread().interrupt();
			}
		}
		
		sshCon[0].runCmds(
			String.format(
				"gdal_calc.py -A NETCDF:\"%1$s_eta.nc\":bathymetry -B NETCDF:\"%1$s_eta.nc\":max_height --calc=\"(A<0)*A + B\" --overwrite --outfile=%2$s",
				outfile, "eWave.2D.sshmax.tiff"
			),
			String.format(
				"gdal_translate -of GSAG %s %s", "eWave.2D.sshmax.tiff", "eWave.2D.sshmax"
			)
		);
		return 0;
	}

	protected void cleanup(EQTask task) throws IOException {
		sshCon[0].runCmd(
			String.format("rm -f eWave.2D.sshmax.* range.xyz* hysea_out_* ~/HySEA.[eo]" + jobid)
		);
		super.cleanup(task);
	}
}
