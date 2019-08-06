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
import java.util.Date;
import java.util.HashMap;
import java.util.List;

import com.mongodb.BasicDBList;
import com.mongodb.BasicDBObject;
import com.mongodb.DB;
import com.mongodb.DBObject;
import com.mongodb.util.JSON;

import GeoHazardServices.EQTask;
import GeoHazardServices.EventSet;
import GeoHazardServices.GlobalParameter;
import GeoHazardServices.IAdapter;
import GeoHazardServices.Services;
import GeoHazardServices.Task;
import Misc.LocalConnection;
import Misc.SshConnection;

public abstract class TsunamiAdapter implements IAdapter {

    protected SshConnection[] sshCon;
    protected DB db;
    protected File workdir;
    protected String hardware;
    protected String args;
    protected LocalConnection localCon;

    private HashMap<String, DBObject> locations;

    private final int convertTimestamp = 1000;
    private final float progressFinished = 100.0f;
    private final double gridresConversion = 60.0;
    private final int cfzValue = 100000;
    private final double convertNano = 1000000000.0;
    private final int timeOffset = 10;

    public TsunamiAdapter(
        final DB database,
        final SshConnection[] connection,
        final File workingdir,
        final String thehardware,
        final String arguments
    ) throws IOException {
        this.db = database;
        this.sshCon = connection;
        this.workdir = workingdir;
        this.hardware = thehardware;
        this.args = arguments;
        this.localCon = new LocalConnection(workingdir.getAbsolutePath());
    }

    /**
     * Handle the request.
     */
    @Override
    public int handleRequest(final Task task) {
        if (task instanceof EQTask) {
            return handleRequest((EQTask) task);
        }
        throw new IllegalArgumentException("TsunamiAdapter requires EQTask.");
    }

    /**
     * Handle the request.
     */
    public int handleRequest(final EQTask task) {
        System.out.println("TsuamiAdapter: " + task);
        try {
            writeFault(task);
            prepareLocations(task);
            writeLocations(task);
            simulate(task);
            System.out.println("createJets");
            /* Create tsunami jets. */
            for (Double ewh: GlobalParameter.jets.keySet()) {
                createJets(task, ewh.toString());
            }
            System.out.println("readLocations");
            readLocations(task);
            System.out.println("finalizeLocations");
            finalizeLocations(task);
            System.out.println("updateProgress");
            updateProgress(task, true);
            System.out.println("finalize");
            finalize(task);
            System.out.println("cleanup");
            cleanup(task);
            return 0;
        } catch (SimulationException e) {
            markAsFailed(task);
            System.err.println(e.getMessage());
            e.printStackTrace();
            return -1;
        } catch (IOException e) {
            return -1;
        }
    }

    protected abstract void writeFault(EQTask task) throws IOException;
    protected abstract void writeLocations(EQTask task) throws IOException;
    protected abstract int simulate(EQTask task)
        throws IOException, SimulationException;
    protected abstract int readLocations(EQTask task) throws IOException;

    private void markAsFailed(final EQTask task) {
        BasicDBObject obj = new BasicDBObject("_id", task.id);
        BasicDBObject setter = new BasicDBObject("process.0.failed", true);
        db.getCollection("eqs").update(obj, new BasicDBObject("$set", setter));

        BasicDBObject event = new BasicDBObject();
        event.append("id", task.id);
        event.append("user", task.user.objId);
        event.append("timestamp", new Date());
        event.append("event", "update");
        db.getCollection("events").insert(event);
    }

    /* Should be called by child classes if progress of simulation has
     * changed. */
    protected int updateProgress(final EQTask task) throws IOException {
        return updateProgress(task, false);
    }

    private int updateProgress(
        final EQTask task,
        final boolean finalize
    ) throws IOException {
        /*  */
        if (task.progress == progressFinished && !finalize) {
            return 0;
        }

        /* create a kml file if at least 10 minutes of simulation are done */
        System.out.println(task.prevSimTime + " -> " + task.curSimTime);
        if (task.curSimTime > task.prevSimTime && task.dt_out > 0) {
            createIsolines(task, task.curSimTime);
        }

        /* DB object to find current earthquake ID */
        BasicDBObject obj = new BasicDBObject("_id", task.id);

        /* create sub-object that is used to update the current progress */
        BasicDBObject setter = new BasicDBObject("raw_progress", task.progress);
        if (task.raw == 0) {
            setter.put("process." + 0 + ".progress", task.progress);
            setter.put("process." + 0 + ".curSimTime", task.curSimTime);
            setter.put("process." + 0 + ".calcTime", task.calcTime);
        }

        /* build update query */
        BasicDBObject update = new BasicDBObject("$set", setter);
        /* update the DB entry with the given ID*/
        db.getCollection("eqs").update(obj, update);

        if (task.raw == 0) {
            /* create DB object that holds all event data */
            BasicDBObject event = new BasicDBObject();
            event.append("id", task.id);
            event.append("user", task.user.objId);
            event.append("timestamp", new Date());
            event.append("event", "progress");
            event.append("progress", task.progress);

            /* create reference event that should be updated */
            BasicDBObject refEvent = new BasicDBObject("id", task.id);
            refEvent.put("event", "progress");

            /* update the reference event with the new data */
            db.getCollection("events").update(refEvent, event, true, false);
        }

        updateEventSet(task);

        return 0;
    }

    private void updateEventSet(final EQTask task) {

        if (task.evtset == null || task.raw == 1) {
            return;
        }

        /* Update Event-Set progress. */
        synchronized (task.evtset) {
            if (task.progress == progressFinished) {
                task.evtset.addTask(task);
            }
            float progress = task.evtset.incOverallProgress(
                (int) (task.curSimTime - task.prevSimTime)
            );
            System.out.println(
                task.evtset.getOverallProgress() + "/" + task.evtset.total_dur
            );
            db.getCollection("evtsets").update(
                new BasicDBObject("_id", task.evtset.setid),
                new BasicDBObject(
                    "$inc",
                    new BasicDBObject(
                        "calcTime",
                        task.calcTime - task.prevCalcTime
                    )
                )
            );
            if (progress != progressFinished) {
                db.getCollection("evtsets").update(
                    new BasicDBObject("_id", task.evtset.setid),
                    new BasicDBObject(
                        "$set", new BasicDBObject("progress", progress)
                    )
                );
            } else {
                task.evtset.setLastTask(task);
            }
        }
    }

    /* Should be called by child classes if the computation was successfully
     * started. */
    protected int initialProgress(final EQTask task) {
            if (task.raw == 1) {
                return 0;
            }

            /* DB object to find current earthquake ID */
            BasicDBObject obj = new BasicDBObject("_id", task.id);

            /* create sub-object that holds all event data */
            BasicDBObject dbObject = new BasicDBObject();
            dbObject.put("progress", 0.0);
            if (task.bbox != null) {
                dbObject.put(
                    "grid_dim",
                    (BasicDBObject) JSON.parse(
                        "{ lonMin: " + task.bbox.lonMin + ", lonMax: "
                        + task.bbox.lonMax + ", latMin: " + task.bbox.latMin
                        + ", latMax: " + task.bbox.latMax + " }"
                    )
                );
            }
            dbObject.put("resolution", task.gridres / gridresConversion);
            dbObject.put("simTime", task.duration);
            dbObject.put("curSimTime", 0.0);
            dbObject.put("calcTime", 0.0);
            dbObject.put("resources", this.hardware);
            dbObject.put("algorithm", task.algo);

            /* create final DB object used to update the collection  */
            BasicDBObject update = new BasicDBObject();
            update.put("$push", new BasicDBObject("process", dbObject));

            /* append a new process entry and return the corresponding index */
            db.getCollection("eqs").findAndModify(
                obj, null, null, false, update, true, false
            );
            return 0;
    }

    /**
     * Save the raw data.
     */
    protected void saveRawData(final EQTask task) throws IOException {
        DBObject dirs = db.getCollection("settings").findOne(
            new BasicDBObject("type", "dirs")
        );
        String resdir = (String) dirs.get("results") + "/events/" + task.id;
        localCon.runCmds(
            String.format("mkdir -p -m 0777 %s", resdir),
            String.format("chmod 0666 %s/*", resdir)
        );
        String[] files = {"eWave.2D.sshmax", "eWave.2D.time"};
        for (String f: files) {
            sshCon[0].copyFile(f, resdir + "/" + f);
        }
        /* Data was successfully stored --> mark event in database. */
        db.getCollection("eqs").update(
            new BasicDBObject("_id", task.id),
            new BasicDBObject("$set", new BasicDBObject("stored", true))
        );
    }

    /**
     * Finalize method.
     */
    protected void finalize(final EQTask task) throws IOException {
        saveRawData(task);

        if (task.evtset == null && task.raw == 0) {
            Services.sendPost(
                GlobalParameter.wsgi_url + "webguisrv/post_compute",
                "evtid=" + task.id
            );
        }

        /* Update Event-Set progress. */
        if (task.evtset != null && task.raw == 0) {
            BasicDBObject set = new BasicDBObject("_id", task.evtset.setid);
            if (task.evtset.isLastTask(task)) {
                /* This worker thread is the last one and must process the
                 * output for the entire event set. */
                evtsetPost(task.evtset);
                db.getCollection("evtsets").update(
                    set,
                    new BasicDBObject(
                        "$set", new BasicDBObject("progress", progressFinished)
                    )
                );
            }
        }
    }

    private int evtsetPost(final EventSet evtset) throws IOException {
        DBObject dirs = db.getCollection("settings").findOne(
            new BasicDBObject("type", "dirs")
        );
        String resdir = (String) dirs.get("results");
        List<EQTask> tasks = evtset.getTasks();
        System.out.println(tasks);
        /* At least one task should be part of the event set. */
        if (tasks.size() < 1) {
            throw new IllegalArgumentException("Something went wrong!");
        }
        for (int i = 0; i < tasks.size(); i++) {
            String taskFile = String.format(
                " %s/events/%s/eWave.2D.sshmax", resdir, tasks.get(i).id
            );
            if (i == 0) {
                /* Copy data of first task directly to output file. */
                sshCon[0].runCmd("cp " + taskFile + " eWave.2D.sshmax_0");
            } else {
                sshCon[0].runCmds(
                    String.format(
                        "gdal_merge.py -separate -o combined_%d.vrt "
                        + "eWave.2D.sshmax_%d %s",
                        i, i - 1, taskFile
                    ),
                    String.format(
                        "gdal_calc.py -A combined_%1$d.vrt --A_band=1 "
                        + "-B combined_%1$d.vrt --B_band=2 "
                        + "--calc=\"maximum(A,B)\" --format=GSBG "
                        + "--outfile eWave.2D.sshmax_%1$d",
                        i
                    )
                );
            }
        }
        sshCon[0].runCmds(
            String.format(
                "cp eWave.2D.sshmax_%d eWave.2D.sshmax", tasks.size() - 1
            ),
            "rm eWave.2D.sshmax_* combined_*.vrt"
        );
        System.out.println("create jets...");
        EQTask dummy = new EQTask(null);
        dummy.id = evtset.setid;
        for (Double ewh: GlobalParameter.jets.keySet()) {
            createJets(dummy, ewh.toString());
        }
        saveRawData(dummy);
        return 0;
    }

    /**
     * Cleanup method.
     */
    protected void cleanup(final EQTask task) throws IOException {
        sshCon[0].runCmd(
            String.format(
                "rm -f heights.*.kml arrival.*.kml fault.inp locations.inp "
                + "eWave.2D.sshmax range.grd"
            )
        );
    }

    /**
     * Get Locations.
     */
    protected HashMap<String, DBObject> getLocations() {
        return locations;
    }

    /**
     * Prepare locations.
     */
    protected void prepareLocations(final EQTask task) {
        locations = new HashMap<String, DBObject>();
        prepareTFPs(task, locations);
        prepareTSPs(task, locations);
        prepareStations(task, locations);
    }

    private void prepareTFPs(
        final EQTask task,
        final HashMap<String, DBObject> hmlocations
    ) {
        DBObject tfpQuery = null;
        if (task.user.inst != null) {
            /* filter TFPs according to institution settings */
            DBObject instObj = db.getCollection("institutions").findOne(
                new BasicDBObject("name", task.user.inst)
            );

            if (instObj != null) {
                @SuppressWarnings("unchecked")
                List<Object> tfpList = (List<Object>) instObj.get("tfps");
                if (tfpList != null) {
                    BasicDBList tfpOrList = new BasicDBList();
                    for (Object s: tfpList) {
                        tfpOrList.add(
                            new BasicDBObject(
                                "code", new BasicDBObject("$regex", s)
                            )
                        );
                    }
                    tfpQuery = new BasicDBObject("$or", tfpOrList);
                }
            }
        }

        for (DBObject obj: db.getCollection("tfps").find(tfpQuery)) {
            String id = (String) obj.get("_id").toString();
            DBObject init = new BasicDBObject();
            init.put("lat", obj.get("lat_sea"));
            init.put("lon", obj.get("lon_sea"));
            init.put("ewh", 0.0);
            init.put("eta", -1.0);
            init.put("tfp", id);
            init.put("EventID", task.id);
            init.put("type", "TFP");
            hmlocations.put(id, init);
        }
    }

    private void prepareTSPs(
        final EQTask task,
        final HashMap<String, DBObject> hmlocations
    ) {
        for (DBObject obj: db.getCollection("tsps").find()) {
            String id = (String) obj.get("_id").toString();
            DBObject init = new BasicDBObject();
            init.put("lat", obj.get("lat_sea"));
            init.put("lon", obj.get("lon_sea"));
            init.put("ewh", 0.0);
            init.put("eta", -1.0);
            init.put("tsp", id);
            init.put("EventID", task.id);
            init.put("cfcz", obj.get("FID_IO_DIS"));
            /* TODO */ init.put("ref", obj.get("ref"));
            init.put("type", "TSP");
            hmlocations.put(id, init);
        }
    }

    private void prepareStations(
        final EQTask task,
        final HashMap<String, DBObject> hmlocations
    ) {
        BasicDBList andList = new BasicDBList();
        /* check if a real user requests this computation */
        DBObject userObj = db.getCollection("users").findOne(
            new BasicDBObject("_id", task.user.objId)
        );
        if (userObj != null) {
            BasicDBList ccodes = (BasicDBList) userObj.get("countries");
            /* if no country specified, set to an empty list */
            if (ccodes == null) {
                ccodes = new BasicDBList();
            }
            andList.add(
                new BasicDBObject("country", new BasicDBObject("$in", ccodes))
            );
        }

        String inst = task.user.inst;
        if (inst == null || inst.equals("gfz") || inst.equals("tdss15")) {
            inst = "gfz_ex_test";
        }
        andList.add(new BasicDBObject("inst", inst));

        for (
            DBObject obj : db.getCollection("stations")
                .find(new BasicDBObject("$and", andList))
        ) {
            String id = (String) obj.get("name");
            DBObject init = new BasicDBObject();
            init.put("lat", obj.get("lat"));
            init.put("lon", obj.get("lon"));
            init.put("values", new ArrayList<DBObject>());
            init.put("type", "STATION");
            hmlocations.put(id, init);
        }
    }

    /**
     * Finalize locations.
     */
    protected void finalizeLocations(final EQTask task) {
        long t0;
        long t1;
        t0 = System.nanoTime();
        HashMap<Integer, Double> maxEWH = new HashMap<Integer, Double>();
        HashMap<Integer, Double> minETA = new HashMap<Integer, Double>();
        /* Temporary data structure used to avoid many database interactions. */
        List<DBObject> comps = new ArrayList<DBObject>();
        List<DBObject> sldata = new ArrayList<DBObject>();
        /* translate date into time stamp */
        long time = task.eqparams.date.getTime() / convertTimestamp;
        for (String id: locations.keySet()) {
            DBObject loc = locations.get(id);
            if (
                loc.get("type").equals("TFP")
                || loc.get("type").equals("TSP")
            ) {
                loc.removeField("lat");
                loc.removeField("lon");
                comps.add(loc);
            } else if (loc.get("type").equals("STATION")) {
                @SuppressWarnings("unchecked")
                List<DBObject> values = (List<DBObject>) loc.get("values");
                for (DBObject obj: values) {
                    long relTime = (long) obj.get("reltime") / task.accel;
                    obj.put("inst", task.user.inst);
                    obj.put("timestamp", time + relTime);
                    obj.put("reltime", relTime);
                    obj.put("station", id);
                    obj.put("evid", task.id);
                    sldata.add(obj);
                }
            }

            /* Update maximal and minimal CFZ values. */
            if (loc.get("type").equals("TSP")) {
                Double ewh = (Double) loc.get("ewh");
                Double eta = (Double) loc.get("eta");
                Integer cfz = (Integer) loc.get("cfcz");
                /* TODO: hack! */
                if (cfz == null) {
                    cfz = cfzValue + (Integer) loc.get("ref");
                }
                if (!maxEWH.containsKey(cfz)) {
                    maxEWH.put(cfz, ewh);
                    minETA.put(cfz, eta);
                }
                maxEWH.put(cfz, Math.max(maxEWH.get(cfz), ewh));
                minETA.put(cfz, Math.min(minETA.get(cfz), eta));
            }
        }
        /* Insert CFZ values into database. */
        for (Integer key: maxEWH.keySet()) {
            DBObject cfz = new BasicDBObject();
            /* TODO: hack! */
            if (key < cfzValue) {
                cfz.put("code", key);
                cfz.put("type", "CFZ");
                cfz.put("ewh", maxEWH.get(key));
                cfz.put("eta", minETA.get(key));
                cfz.put("EventID", task.id);
            } else {
                cfz.put("ref", key - cfzValue);
                cfz.put("type", "city");
                cfz.put("ewh", maxEWH.get(key));
                cfz.put("eta", minETA.get(key));
                cfz.put("EventID", task.id);
            }
            comps.add(cfz);
        }
        /* Bulk insert. */
        t1 = System.nanoTime();
        db.getCollection("comp").insert(comps);
        System.out.println("Comp: " + (System.nanoTime() - t1) / convertNano);
        t1 = System.nanoTime();
        db.getCollection("simsealeveldata").insert(sldata);
        System.out.println(
            "Sealevel: " + (System.nanoTime() - t1) / convertNano
        );
        System.out.println("Total: " + (System.nanoTime() - t0) / convertNano);
    }

    /**
     * createJets method.
     */
    protected int createJets(
        final EQTask task,
        final String ewh
    ) throws IOException {
        /* Nothing to do if a raw computation was requested. */
        if (task.raw > 0) {
            return 0;
        }

        String kmlFile = String.format("heights.%s.kml", ewh);

        /* ssh should be okay upon here, therefore run commands */
        sshCon[0].runCmds(
            String.format(
                "gdal_contour -f kml -fl %1$s eWave.2D.sshmax "
                + "heights.%1$s.kml",
                ewh
            ),
            String.format(
                "ogr2ogr -f kml -simplify 0.001 heights.%1$s.kml "
                + "heights.%1$s.kml",
                ewh
            )
        );
        sshCon[0].copyFile(kmlFile, workdir + "/" + kmlFile);

        localCon.runCmd(
            String.format(
                "python3 ../getEWH.py heights.%1$s.kml %1$s %2$s",
                ewh, task.id
            )
        );
        return 0;
    }

    /**
     * createIsolines method.
     */
    protected int createIsolines(
        final EQTask task,
        final int time
    ) throws IOException {
        /* Nothing to do if a raw computation was requested. */
        if (task.raw > 0) {
            return 0;
        }

        /* Use second ssh connection. */
        sshCon[1].runCmd(
            String.format(
                "ogr2ogr -f kml -simplify 0.001 arrival.%1$d.kml "
                + "arrival.%1$d.kml",
                time - timeOffset
            )
        );
        String kmlFile = String.format("arrival.%d.kml", time - timeOffset);
        sshCon[1].copyFile(kmlFile, workdir + "/" + kmlFile);
        localCon.runCmd(
            String.format(
                "python3 ../getShape.py arrival.%1$d.kml %1$d %2$s",
                time - timeOffset, task.id
            )
        );

        return 0;
    }
}
