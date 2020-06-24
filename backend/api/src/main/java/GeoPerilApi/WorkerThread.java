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

package GeoPerilApi;

import java.io.File;
import java.io.IOException;
import java.util.List;

import FloodPrototype.FloodAdapter;
import FloodPrototype.FloodTask;
import Misc.SshConnection;
import Tsunami.EasyWaveAdapter;
import Tsunami.HySeaAdapter;
import Tsunami.TsunamiAdapter;

import com.mongodb.DB;
import com.mongodb.MongoClient;
import com.mongodb.ServerAddress;

public final class WorkerThread implements Runnable, Comparable<WorkerThread> {
    private IScheduler scheduler;
    private File workdir;
    private SshConnection[] sshCon;

    private Thread thread;
    private MongoClient dbclient;
    private DB db;

    private String hardware;
    private String args;

    private Integer priority;
    private int slot = IScheduler.SLOT_NORMAL;
    private Object lock;
    private Task task;

    private FloodAdapter floodAdapter;
    private TsunamiAdapter hySeaAdapter;
    private TsunamiAdapter easyWaveAdapter;

    public WorkerThread(
        final IScheduler workerScheduler,
        final List<ServerAddress> addresses,
        final String dbname,
        final String workerWorkdir
    ) throws IOException {
        this.scheduler = workerScheduler;
        this.lock = new Object();
        this.priority = new Integer(0);

        this.workdir = new File(workerWorkdir);

        if (!this.workdir.isDirectory()
            && !this.workdir.mkdir()) {
            throw new IOException(
                "Could not create working directory " + this.workdir
            );
        }

        dbclient = new MongoClient(addresses);
        db = dbclient.getDB(dbname);
    }

    public int setRemote(
        final String user,
        final String host,
        final String dir
    ) {
        sshCon = new SshConnection[2];

        for (int i = 0; i < 2; i++) {
            try {
                sshCon[i] = new SshConnection(user, host, dir);
            } catch (IOException e) {
                e.printStackTrace();
                return 1;
            }
        }

        /* TODO: not the right place */
        try {
            floodAdapter = new FloodAdapter(db, sshCon, workdir, hardware);
            hySeaAdapter = new HySeaAdapter(
                db, sshCon, workdir, hardware, args
            );
            easyWaveAdapter = new EasyWaveAdapter(
                db, sshCon, workdir, hardware, args
            );
        } catch (IOException e) {
            e.printStackTrace();
            return 1;
        }

        return 0;
    }

    public void setHardware(final String setHardware) {
        this.hardware = setHardware;
    }

    public void setArgs(final String setArgs) {
        this.args = setArgs;
    }

    public void setPriority(final int setPriority) {
        this.priority = setPriority;
    }

    public void setSlot(final int setSlot) {
        this.slot = setSlot;
    }

    public int getSlot() {
        return this.slot;
    }

    public void start() {
        thread = new Thread(this);
        thread.start();
    }

    public void stop() {
        thread.interrupt();

        try {
            thread.join();
        } catch (InterruptedException e) {
            e.printStackTrace();
        }

        dbclient.close();

        for (int i = 0; i < 2; i++) {
            sshCon[i].close();
        }

        for (File f: workdir.listFiles()) {
            f.delete();
        }

        workdir.delete();
    }

    @Override
    public void run() {
        System.out.println("Thread " + this.thread.getId() + " started");

        while (true) {
            try {
                getWork();
                checkSshConnection();

                System.out.println(
                    "Thread " + this.thread.getId() + " computes event "
                    + task.id
                );
                int ret = 0;
                if (task instanceof EQTask) {
                    if (((EQTask) task).algo.equals("hysea")) {
                        ret = hySeaAdapter.handleRequest(task);
                    } else {
                        //handleRequest( (EQTask) task );
                        ret = easyWaveAdapter.handleRequest(task);
                    }
                } else if (task instanceof FloodTask) {
                    ret = floodAdapter.handleRequest(task);
                }

                if (ret > 0) {
                    task.markAsDone();
                } else {
                    task.markAsError();
                }

            } catch (InterruptedException e) {
                break;
            }
        }

    }

    private int checkSshConnection() {
        /* check if ssh connection is still established */
        sshCon[0].out().println("echo '\n'");
        sshCon[0].out().flush();
        try {
            if (sshCon[0].in().readLine() == null) {
                System.err.println(
                    "Error: ssh connection was closed. Trying to reconnect..."
                );
                sshCon[0].connect();
                sshCon[1].connect();
            }
        } catch (IOException e) {
            e.printStackTrace();
            return 1;
        }
        return 0;
    }

    @Override
    public int compareTo(final WorkerThread o) {
        return priority.compareTo(o.priority);
    }

    private Task getWork() throws InterruptedException {
        synchronized (lock) {
            task = null;
            scheduler.submit(this);

            while (task == null) {
                lock.wait();
            }

            return task;
        }
    }

    public void putWork(final Task putTask) {
        synchronized (lock) {
            this.task = putTask;
            lock.notify();
        }
    }
}
