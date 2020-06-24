/*
 * GeoPeril - A platform for the computation and web-mapping of hazard specific
 * geospatial data, as well as for serving functionality to handle, share, and
 * communicate threat specific information in a collaborative environment.
 *
 * Copyright (C) 2013 GFZ German Research Centre for Geosciences
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the Licence is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the Licence for the specific language governing permissions and
 * limitations under the Licence.
 *
 * Contributors:
 * Johannes Spazier (GFZ) - initial implementation
 * Sven Reissland (GFZ) - initial implementation
 * Martin Hammitzsch (GFZ) - initial implementation
 */

package Tsunami;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.mongodb.BasicDBObject;
import com.mongodb.DB;
import com.mongodb.DBObject;

import GeoPerilApi.EQParameter;
import GeoPerilApi.EQTask;
import Misc.BetterStringBuilder;
import Misc.SshConnection;

public final class HySeaAdapter extends TsunamiAdapter {

    private final String outfile = "hysea_out";
    private int jobid = 0;
    /* Used to map column number to locations id of input and output file. */
    private List<String> ids;

    private final int maxLat = 90;
    private final int minLat = -90;
    private final double minMargin = 7.5;
    private final double marginDurationDivisor = 10.0;
    private final int convertToSeconds = 60;
    private final float convertToSecondsF = 60.0f;
    private final double outsideGridThreshold = -9999.0;
    private final float convertPercent = 100.0f;
    private final float convertNano = 1000000.0f;
    private final float updateProgressThreshold = 5.0f;
    private final int simulateSleepTime = 2000;

    public HySeaAdapter(
        final DB db,
        final SshConnection[] sshCon,
        final File workdir,
        final String hardware,
        final String args
    ) throws IOException {
        super(db, sshCon, workdir, hardware, args);
    }

    @Override
    protected void writeFault(final EQTask task) throws IOException {
        BetterStringBuilder strFault = new BetterStringBuilder();
        EQParameter eqp = task.eqparams;

        /* Compute bounding box. */
        double margin = minMargin + task.duration / marginDurationDivisor;
        double ulx = eqp.lon - margin;
        double lrx = eqp.lon + margin;
        double uly = Math.min(eqp.lat + margin, maxLat);
        double lry = Math.max(eqp.lat - margin, minLat);
        task.setBoundingBox(ulx, lrx, lry, uly);
        System.out.println(
            "BBox: " + ulx + ", " + uly + " - " + lrx + ", " + lry
        );
        sshCon[0].runCmds(
            String.format(
                Locale.US,
                "gdal_translate -projwin %f %f %f %f -of GSBG "
                + "/data/grid_%d.grd range.grd",
                ulx, uly, lrx, lry, task.gridres
            ),
            String.format(
                "gdal_calc.py -A range.grd --calc=\"-A\" --overwrite "
                + "--outfile=range.grd"
            )
        );

        /* Determine size of grid. */
        int xsize = 0;
        int ysize = 0;
        for (String line: sshCon[0].runCmd("gdalinfo range.grd")) {
            Matcher matcher = Pattern.compile("Size is (\\d*), (\\d*)")
                .matcher(line);
            if (matcher.find()) {
                xsize = Integer.valueOf(matcher.group(1));
                ysize = Integer.valueOf(matcher.group(2));
            }
        }

        /* Translate grid to binary XYZ. */
        sshCon[0].runCmds(
            "gdal_translate -of XYZ range.grd range.xyz.bat",
            "binconvert.exe range.xyz",
            "mv range.xyz_bin.bat range.xyz.bin"
        );

        /* Write input file. */
        strFault.appendln("range");
        strFault.appendln(xsize);
        strFault.appendln(ysize);
        strFault.appendln("range.xyz.bin");
        strFault.appendln("1");
        strFault.appendln(
            String.format(
                Locale.US,
                "%f\n%f\n%f\n%f\n%f\n%f\n%f\n%f\n%f",
                eqp.lon, eqp.lat, eqp.depth, eqp.length,
                eqp.width, eqp.strike, eqp.dip, eqp.rake, eqp.slip
            )
        );
        strFault.appendln("-500.0\n500.0\n-500.0\n500.0");
        strFault.appendln(outfile);
        strFault.appendln("1");
        strFault.appendln("1");
        strFault.appendln("1");
        strFault.appendln("1");
        strFault.appendln((task.duration * convertToSeconds + 2));
        strFault.appendln(task.dt_out * convertToSeconds);
        strFault.appendln("1 # readFromFile");
        strFault.appendln("locations.inp # file with locations");
        strFault.appendln("60 # saving time of locations");
        strFault.appendln("0.5");
        strFault.appendln("5e-3");
        strFault.appendln("20");
        strFault.appendln("0.2");
        strFault.appendln("0.03");
        strFault.appendln("100");
        strFault.appendln("100000");
        strFault.appendln("1000");

        sshCon[0].writeFile(strFault.toString(), "fault.inp");
    }

    @Override
    protected void writeLocations(final EQTask task) throws IOException {
        BetterStringBuilder strLocations = new BetterStringBuilder();
        HashMap<String, DBObject> locations = getLocations();
        strLocations.appendln(locations.size());
        ids = new ArrayList<String>();
        for (String id: locations.keySet()) {
            DBObject loc = locations.get(id);
            ids.add(id);
            strLocations.appendln(loc.get("lon") + "\t" + loc.get("lat"));
        }
        sshCon[0].writeFile(strLocations.toString(), "locations.inp");
        sshCon[0].runCmds(
            String.format(
                Locale.US,
                "points2water.py locations.inp ../grid_%d.grdx",
                task.gridres
            )
        );
    }

    @Override
    protected int readLocations(final EQTask task) throws IOException {
        /* TODO: move? */
        if (task.raw > 0) {
            return 0;
        }

        /* Translate binary output to text. */
        sshCon[0].runCmds(
            "ts_minmax_bin2txt.sh hysea_out_ts_minmax.bin "
            + "> hysea_out_ts_minmax.txt",
            "ts_bin2txt.sh hysea_out_ts.bin > hysea_out_ts.txt"
        );

        System.out.println("readLocations 1");
        HashMap<String, DBObject> locations = getLocations();
        /* Read TFPs and TSPs from text file. */
        List<String> lines = sshCon[0].readFile("hysea_out_ts_minmax.txt");
        /* Second line contains (min,max) values. */
        String[] data = lines.get(1).split("\\s+");
        /* Every second column stores maximum value. */
        for (int i = 0; i < data.length / 2; i++) {
            DBObject loc = locations.get(ids.get(i));
            if (loc.get("type").equals("TFP")
                || loc.get("type").equals("TSP")) {
                loc.put("ewh", Double.valueOf(data[2 * i + 1]));
            }
        }

        System.out.println("readLocations 2");
        /* Process stations! */
        lines = sshCon[0].readFile("hysea_out_ts.txt");
        List<Double> initialValues = new ArrayList<Double>();
        for (String line: sshCon[0].readFile("hysea_out_ts.txt")) {
            data = line.split("\\s+");
            long relTime = Double.valueOf(data[0]).longValue();
            for (int j = 1; j < data.length; j++) {
                Double value = Double.valueOf(data[j]);
                DBObject loc = locations.get(ids.get(j - 1));
                /* Store initial water height for each location. */
                if (relTime == 0) {
                    initialValues.add(value);
                }
                /* Skip locations outside the grid. */
                if (value == outsideGridThreshold) {
                    continue;
                }
                /* Find estimated time of arrival. */
                if (loc.get("type").equals("TFP")
                    || loc.get("type").equals("TSP")) {
                    if ((Double) loc.get("eta") == -1.0
                        && !initialValues.get(j - 1).equals(value)) {
                        loc.put("eta", (double) relTime);
                    }
                }
                /* Add value to time series of station. */
                if (loc.get("type").equals("STATION")) {
                    @SuppressWarnings("unchecked")
                    List<DBObject> values = (List<DBObject>) loc.get("values");
                    values.add(
                        new BasicDBObject("reltime", relTime)
                            .append("value", value)
                    );
                }
            }
        }
        return 0;
    }

    @Override
    protected int simulate(final EQTask task)
            throws IOException, SimulationException {
        initialProgress(task);

        String line;
        long start = System.nanoTime();
        sshCon[0].runLiveCmd("hysea fault.inp");
        while ((line = sshCon[0].nextLine()) != null) {
            Matcher matcher = Pattern.compile("Time = (\\d+\\.?\\d*) sec")
                .matcher(line);
            if (matcher.find()) {
                float time = Float.valueOf(matcher.group(1));
                task.progress = Math.min(
                    time / (task.duration * convertToSecondsF),
                    1.0f
                ) * convertPercent;
                task.calcTime = (System.nanoTime() - start) / convertNano;
                if (
                    time % (task.dt_out * convertToSecondsF)
                    < updateProgressThreshold
                ) {
                    task.prevSimTime = task.curSimTime;
                    task.curSimTime = (int) (
                            time / (task.dt_out * convertToSecondsF)
                        )
                        * task.dt_out;
                    updateProgress(task);
                }
            }
        }
        if (sshCon[0].returnValue() != 0) {
            throw new SimulationException("HySEA failed!");
        }

        updateProgress(task);

        sshCon[0].runCmds(
            String.format(
                "gdal_calc.py -A NETCDF:\"%1$s_eta.nc\":bathymetry "
                + "-B NETCDF:\"%1$s_eta.nc\":max_height "
                + "--calc=\"(A<0)*A + B\" --overwrite --outfile=%2$s",
                outfile,
                "eWave.2D.sshmax.tiff"
            ),
            String.format(
                "gdal_translate -of GSBG %s %s",
                "eWave.2D.sshmax.tiff",
                "eWave.2D.sshmax"
            )
        );
        return 0;
    }

    @Deprecated
    protected int simulate_job(final EQTask task) throws IOException {
        jobid = 0;
        for (String line: sshCon[0].runCmd("qsub ../run_hysea.sh -d `pwd`")) {
            Matcher matcher = Pattern.compile("(\\d*)\\.atlantico.local")
                .matcher(line);
            if (matcher.find()) {
                jobid = Integer.valueOf(matcher.group(1));
            }
        }
        if (jobid == 0) {
            return -1;
        }
        System.out.println(jobid);

        initialProgress(task);

        long start = System.nanoTime();
        boolean finished = false;
        int lnr = 1;
        task.curSimTime = 0;
        while (!finished) {
            boolean changed = false;
            /* TODO: No idea why '\n\004' is needed here.
             * Must have something to do with the embedded ssh command in
             * hysea_status.sh. */
            for (String line: sshCon[0].runCmd(
                    "hysea_status.sh " + jobid
                    + " | tail -n +" + lnr
                    + "; echo '\n\004'"
                )
            ) {
                Matcher matcher = Pattern.compile("Time = (\\d+\\.?\\d*) sec")
                    .matcher(line);
                if (matcher.find()) {
                    float time = Float.valueOf(matcher.group(1));
                    task.progress = Math.min(
                        time / (task.duration * convertToSecondsF),
                        1.0f
                    ) * convertPercent;
                    task.calcTime = (System.nanoTime() - start) / convertNano;
                    changed = true;
                    if (
                        time % (task.dt_out * convertToSecondsF)
                        < updateProgressThreshold
                    ) {
                        task.prevSimTime = task.curSimTime;
                        task.curSimTime = (int) (
                                time / (task.dt_out * convertToSecondsF)
                            )
                            * task.dt_out;
                        updateProgress(task);
                        changed = false;
                    }
                }
                if (line.startsWith("Runtime")) {
                    finished = true;
                }
                lnr++;
            }
            if (changed) {
                updateProgress(task);
                System.out.println(task.progress);
            }
            try {
                Thread.sleep(simulateSleepTime);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }

        sshCon[0].runCmds(
            String.format(
                "gdal_calc.py -A NETCDF:\"%1$s_eta.nc\":bathymetry "
                + "-B NETCDF:\"%1$s_eta.nc\":max_height "
                + "--calc=\"(A<0)*A + B\" --overwrite --outfile=%2$s",
                outfile, "eWave.2D.sshmax.tiff"
            ),
            String.format(
                "gdal_translate -of GSBG %s %s",
                "eWave.2D.sshmax.tiff",
                "eWave.2D.sshmax"
            )
        );
        return 0;
    }

    protected int createIsolines(final EQTask task, final int time)
            throws IOException {
        /* Generate travel times as KML file. */
        sshCon[1].runCmds(
            String.format(
                "gdal_calc.py -A NETCDF:\"%1$s_eta.nc\":bathymetry "
                + "-B NETCDF:\"%1$s_eta.nc\":eta --B_band %2$d "
                + "--calc=\"((A>0)*B)!=0\" --overwrite "
                + "--outfile=arrival.%3$d.tiff",
                outfile, time / task.dt_out + 1, time
            ),
            String.format(
                "gdal_contour -f kml -fl 0.5 arrival.%1$d.tiff "
                + "arrival.%1$d.kml",
                time
            )
        );
        return super.createIsolines(task, time);
    }

    protected void cleanup(final EQTask task) throws IOException {
        sshCon[0].runCmd(
            String.format(
                "rm -f eWave.2D.sshmax.* range.xyz* "
                + "hysea_out_* arrival.*.tiff ~/HySEA.[eo]" + jobid
            )
        );
        super.cleanup(task);
    }
}
