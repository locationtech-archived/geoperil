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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.mongodb.BasicDBObject;
import com.mongodb.DB;
import com.mongodb.DBObject;

import GeoPerilApi.EQParameter;
import GeoPerilApi.EQTask;
import Misc.BetterStringBuilder;
import Misc.SshConnection;

public final class EasyWaveAdapter extends TsunamiAdapter {
    private final int convertToSeconds = 60;
    private final int convertToMinutes = 60;
    private final float convertToPercent = 100.0f;
    private final int extraTime = 10;

    public EasyWaveAdapter(
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
        EQParameter eqp = task.eqparams;
        BetterStringBuilder strFault = new BetterStringBuilder();
        strFault.appendManyNl(
            eqp.mw != 0
                ? "-mw " + eqp.mw
                : String.format(
                    "-slip %f -size %f %f", eqp.slip, eqp.length, eqp.width
                ),
            String.format(" -location %f %f %f -strike %f -dip %f -rake %f",
                eqp.lon, eqp.lat, eqp.depth, eqp.strike, eqp.dip, eqp.rake
            )
        );
        sshCon[0].writeFile(strFault.toString(), "fault.inp");
    }

    @Override
    protected void writeLocations(final EQTask task) throws IOException {
        BetterStringBuilder strLocations = new BetterStringBuilder();
        HashMap<String, DBObject> locations = getLocations();
        for (String id: locations.keySet()) {
            DBObject loc = locations.get(id);
            strLocations.appendln(
                id + "\t" + loc.get("lon") + "\t"
                + loc.get("lat")
            );
        }
        sshCon[0].writeFile(strLocations.toString(), "locations.inp");
    }

    @Override
    protected int readLocations(final EQTask task) throws IOException {
        if (task.raw > 0) {
            return 0;
        }

        HashMap<String, DBObject> locations = getLocations();
        /* Read TFPs and TSPs from file. */
        List<String> lines = sshCon[0].readFile("eWave.poi.summary");
        /* skip headline */
        for (int i = 1; i < lines.size(); i++) {
            String[] data = lines.get(i).split("\\s+");
            String id = data[0];
            DBObject loc = locations.get(id);
            if (loc.get("type").equals("TFP")
                || loc.get("type").equals("TSP")) {
                loc.put("eta", Double.valueOf(data[1]));
                loc.put("ewh", Double.valueOf(data[2]));
            }
        }

        /* Read stations from file. */
        Map<Integer, String> statIds = new HashMap<Integer, String>();
        lines = sshCon[0].readFile("eWave.poi.ssh");
        /* search for stations in headline and store related index */
        for (int i = 0; i < lines.size(); i++) {
            String[] data = lines.get(i).trim().split("\\s+");
            if (i == 0) {
                for (int j = 1; j < data.length; j++) {
                    String id = data[j];
                    DBObject loc = locations.get(id);
                    if (loc.get("type").equals("STATION")) {
                        statIds.put(j, id);
                    }
                }
                continue;
            }

            long relTime = (long) (Float.valueOf(data[0]) * convertToSeconds);
            if (relTime > task.duration * convertToSeconds) {
                break;
            }

            /* extract value of each station for the next timestamp */
            for (Integer j: statIds.keySet()) {
                @SuppressWarnings("unchecked")
                List<DBObject> values = (List<DBObject>) locations.get(
                    statIds.get(j)
                ).get("values");
                values.add(
                    new BasicDBObject("reltime", relTime)
                    .append("value", data[j])
                );
            }
        }
        return 0;
    }

    @Override
    protected int simulate(final EQTask task)
    throws IOException, SimulationException {
        int simTime = task.duration + extraTime;
        String cmdParams = String.format(
            "-grid /data/grid_%d.grd -poi locations.inp -poi_dt_out 30 -poi_"
            + "search_dist 20 -source fault.inp -propagation %d -step 1 "
            + "-dump %d -ssh_arrival 0.001 -time %d -verbose -adjust_ztop %s",
            task.gridres, task.dt_out, task.dt_out * convertToSeconds,
            simTime, args
        );
        String line;
        task.curSimTime = 0;
        task.calcTime = 0.0f;
        sshCon[0].runLiveCmd("easywave " + cmdParams);
        while ((line = sshCon[0].nextLine()) != null) {
            Matcher matcher = Pattern.compile(
                "range: (.*) (.*) (.*) (.*)"
            ).matcher(line);
            if (matcher.find()) {
                /* get region boundaries */
                double lonMin = Double.valueOf(matcher.group(1));
                double lonMax = Double.valueOf(matcher.group(2));
                double latMin = Double.valueOf(matcher.group(3));
                double latMax = Double.valueOf(matcher.group(4));
                task.setBoundingBox(lonMin, lonMax, latMin, latMax);
                initialProgress(task);
                continue;
            }
            /* check if output line contains progress report */
            matcher = Pattern.compile(
                "(\\d\\d):(\\d\\d):(\\d\\d).*elapsed: (\\d*) msec"
            ).matcher(line);
            if (!matcher.find()) {
                continue;
            }
            System.out.println(matcher.group());
            /* parse current simulation time */
            int hours = Integer.valueOf(matcher.group(1));
            int min = Integer.valueOf(matcher.group(2));
            int totalMin = hours * convertToMinutes + min;

            /* calculate current progress in percentage */
            task.progress = ((float) totalMin / (float) simTime)
                * convertToPercent;
            task.prevSimTime = task.curSimTime;
            task.curSimTime = totalMin;
            task.prevCalcTime = task.calcTime;
            task.calcTime = Integer.valueOf(matcher.group(4));

            updateProgress(task);
        }
        if (sshCon[0].returnValue() != 0) {
            throw new SimulationException("EasyWave failed!");
        }
        return 0;
    }

    protected int createIsolines(final EQTask task, final int time)
    throws IOException {
        /* Generate travel times as KML file. */
        sshCon[1].runCmd(
            String.format(
                "gdal_contour -f kml -i 10 -fl %1$d eWave.2D.time "
                + "arrival.%1$d.kml",
                time - extraTime
            )
        );
        return super.createIsolines(task, time);
    }

    @Override
    protected void cleanup(final EQTask task) throws IOException {
        sshCon[0].runCmd(
            String.format("rm -f eWave.* easywave.log")
        );
        super.cleanup(task);
    }
}
