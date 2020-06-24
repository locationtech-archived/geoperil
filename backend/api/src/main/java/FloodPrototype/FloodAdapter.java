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

package FloodPrototype;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.util.Date;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.mongodb.BasicDBObject;
import com.mongodb.DB;
import com.mongodb.DBObject;

import GeoPerilApi.IAdapter;
import GeoPerilApi.Task;
import Misc.SshConnection;

public final class FloodAdapter implements IAdapter {

    private SshConnection[] sshCon;
    private DB db;
    private File workdir;
    private String hardware;

    private final int dummyYear = 2002;
    private final int dummyHour = 5332;
    private final float percentFinished = 100.0f;
    private final int[] defaultHeights = {1, 3, 5};

    public FloodAdapter(
        final DB database,
        final SshConnection[] connection,
        final File workingdir,
        final String hardwarestr
    ) {
        this.db = database;
        this.sshCon = connection;
        this.workdir = workingdir;
        this.hardware = hardwarestr;
    }

    @Override
    public int handleRequest(final Task task) {
        if (task instanceof FloodTask) {
            return handleRequest((FloodTask) task);
        }
        throw new IllegalArgumentException("FloodAdapter requires FloodTask.");
    }

    private int handleRequest(final FloodTask task) {
        System.out.println("flood task");
        writeInputFiles(task);
        try {
            startFlood2D(task);
            createOutput(task);
        } catch (IOException | InterruptedException e) {
            e.printStackTrace();
            return 1;
        }
        return 0;
    }

    private int writeInputFiles(final FloodTask task) {

        StringBuilder strHydros = new StringBuilder();
        StringBuilder strPoints = new StringBuilder();
        StringBuilder strDef = new StringBuilder();

        strHydros.append(task.getLocations().size() + "\n");
        /* Assume hour resolution to be fixed. */
        strHydros.append("3600\n year hour\t");
        strPoints.append("ProdID\tnumbers\tX1\tY1\tX2\tY2\tX3\tY3");
        for (Location loc: task.getLocations()) {
            strHydros.append(loc.getId() + "\t");
            strPoints.append(
                String.format(Locale.ENGLISH, "\n%d\t%d\t%d\t%d %d\t%d %d\t%d",
                    loc.getId(), loc.getNumbers(), loc.getX1(), loc.getY1(),
                    loc.getX2(), loc.getY2(), loc.getX3(), loc.getY3()
                )
            );
        }
        int hour = dummyHour;
        Location base = task.getLocations().get(0);
        for (int i = 0; i < base.getHydros().size(); i++) {
            strHydros.append("\n");
            strHydros.append(dummyYear + "\t" + hour + "\t");
            for (Location loc: task.getLocations()) {
                strHydros.append(loc.getHydros().get(i)).append("\t");
            }
            hour++;
        }

        /* definition file */
        strDef.append("../dem100mulde.txt\n");
        strDef.append("./sourcepoints.txt\n");
        strDef.append("./breachhydrographs.txt\n");
        strDef.append("../levelfile.txt\n");
        strDef.append("./out\n");
        strDef.append("0.4\n");
        strDef.append(task.getLocations().size() + "\n");
        strDef.append("file\n");
        strDef.append("../mn100mulde.txt\n");
        strDef.append("homo\n");
        strDef.append("0\n");
        strDef.append("5\n");
        strDef.append("0.01\n");
        strDef.append("10\n");
        strDef.append("2\n");

        sshCon[0].writeFile(strHydros.toString(), "breachhydrographs.txt");
        sshCon[0].writeFile(strPoints.toString(), "sourcepoints.txt");
        sshCon[0].writeFile(strDef.toString(), "Elbe.def");

        return 0;
    }

    private int startFlood2D(final FloodTask task) throws IOException {

        BufferedReader reader = sshCon[0].in();

        sshCon[0].out().println("flood2d");
        sshCon[0].out().println("echo '\004'");
        sshCon[0].out().flush();

        String line = reader.readLine();
        while (line != null && !line.equals("\004")) {

            /* check if output line contains progress report */
            /* TODO */
            Matcher matcher = Pattern.compile(
                "Elapsed:\\s*(\\d*.\\d*)s\\s*(\\d*.\\d*)%"
            ).matcher(line);

            if (matcher.find()) {
                float progress = Float.valueOf(matcher.group(2));
                float calcTime = Float.valueOf(matcher.group(1));
                if (progress == percentFinished) {
                    /* TODO: create water height kml + insert into DB */
                    System.out.println("Finished");
                }

                System.out.println(matcher.group(1) + " - " + matcher.group(2));

                /* DB object to find current earthquake ID */
                BasicDBObject obj = new BasicDBObject("_id", task.id);

                /* create sub-object that is used to update the current
                 * progress */
                BasicDBObject process = new BasicDBObject();
                process.put("progress", progress);
                process.put("calcTime", calcTime);
                process.put("resources", this.hardware);

                BasicDBObject setter = new BasicDBObject("process", process);

                /* build update query */
                BasicDBObject update = new BasicDBObject("$set", setter);

                /* update the DB entry with the given ID*/
                System.out.println(obj);
                System.out.println(update);
                db.getCollection("floodsims").update(obj, update);

                /* create DB object that holds all event data */
                BasicDBObject event = new BasicDBObject();
                event.append("id", task.id);
                event.append("user", task.user.objId);
                event.append("timestamp", new Date());
                event.append("event", "progress");
                event.append("class", "flood");
                event.append("process", process);

                /* create reference event that should be updated */
                BasicDBObject refEvent = new BasicDBObject("id", task.id);
                refEvent.put("event", "progress");
                refEvent.put("class", "flood");

                /* update the reference event with the new data */
                db.getCollection("events").update(refEvent, event, true, false);
            }

            line = reader.readLine();
        }

        return 0;
    }

    private int createOutput(final FloodTask task)
        throws IOException, InterruptedException {

        sshCon[0].runCmd(
            "gdalwarp -s_srs EPSG:32632 -t_srs EPSG:4326 "
            + "wstmax_gpu.asc wstmax_gpu.asc.wsg84"
        );

        for (int height: defaultHeights) {
            sshCon[0].runCmd(
                "gdal_contour -f kml -fl "
                + height
                + " wstmax_gpu.asc.wsg84 wstmax_gpu.asc.kml"
            );
            sshCon[0].copyFile(
                "wstmax_gpu.asc.kml",
                workdir + "/wstmax_gpu.asc.kml"
            );

            Process p = Runtime.getRuntime().exec(
                "python ../getFlood.py wstmax_gpu.asc.kml " + task.id + " "
                + height, null, workdir
            );
            p.waitFor();
        }

        /* translate result grid to golden software binary grid and move to
         * persistent location in file system */
        DBObject dirs = db.getCollection("settings").findOne(
            new BasicDBObject("type", "dirs")
        );
        String resdir = (String) dirs.get("results");
        String outdir = String.format("%s/events/%s", resdir, task.id);
        String outfile = outdir + "/wstmax_gpu.grid";

        System.out.println(outdir);
        System.out.println(new File(outdir).mkdirs());

        sshCon[0].runCmd(
            "gdal_translate -of GSBG wstmax_gpu.asc.wsg84 wstmax_gpu.grid"
        );
        sshCon[0].copyFile("wstmax_gpu.grid", outfile);
        return 0;
    }
}
