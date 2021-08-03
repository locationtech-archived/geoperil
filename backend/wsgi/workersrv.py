# GeoPeril - A platform for the computation and web-mapping of hazard specific
# geospatial data, as well as for serving functionality to handle, share, and
# communicate threat specific information in a collaborative environment.
#
# Copyright (C) 2021 GFZ German Research Centre for Geosciences
#
# SPDX-License-Identifier: Apache-2.0
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#   http://apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the Licence is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the Licence for the specific language governing permissions and
# limitations under the Licence.
#
# Contributors:
#   Johannes Spazier (GFZ)
#   Sven Reissland (GFZ)
#   Martin Hammitzsch (GFZ)
#   Matthias Rüster (GFZ)
#   Hannes Fuchs (GFZ)

import os
import logging
import time
import json
import cherrypy
from cherrypy._cperror import HTTPError
from cherrypy.lib.static import serve_file
from base import jsfail, jsdeny, jssuccess, checkpassword, \
    startapp, config, JSONEncoder, recursivelistdir, hashfile
from basesrv import BaseSrv

logger = logging.getLogger("WorkerSrv")


class WorkerSrv(BaseSrv):
    def __init__(self, db):
        BaseSrv.__init__(self, db)
        self._db["workers"].ensure_index("workerid", unique=True)
        self._db["tasks"].ensure_index("taskid", unique=True)

    @cherrypy.expose
    @cherrypy.tools.allow(methods=['POST'])
    def register(self, inst, secret, workerid, name, priority, providedsims):
        inst = self._db["institutions"].find_one({
            "name": inst,
            "secret": secret
        })
        if inst is not None:
            find = self._db["workers"].find_one({"workerid": workerid})
            if find is None:
                worker = {
                    "workerid": workerid,
                    "inst": inst["name"],
                    "name": name,
                    "priority": int(priority),
                    "providedsimtypes": [
                        s.strip() for s in providedsims.split(",")
                    ],
                    "state": "offline",
                    "lastcontact": time.time(),
                    "task": None,
                    "progress": None,
                }
                self._db["workers"].insert(worker)
                return jssuccess()
            return jsfail()
        return jsdeny()

    @cherrypy.expose
    def waitforwork(self, workerid):
        worker = self._db["workers"].find_one({"workerid": workerid})
        if worker is None:
            return jsdeny()

        self._db["workers"].update(
            {"workerid": workerid},
            {"$set": {"lastcontact": time.time()}}
        )

        def handler(self, workerid):
            count = 0
            while count < 60:
                self._db["workers"].update(
                    {"lastcontact": {"$lt": time.time() - 60}},
                    {"$set": {"state": "offline"}}
                )
                task = self._db["tasks"].find_and_modify(
                    {"state": "queued"},
                    update={"$set": {"state": "pending"}},
                    sort=[("created", 1)],
                    new=True
                )
                if task is not None:
                    if set(task.keys()).issuperset(
                            set(["taskid", "simtype", "created", "state"])
                    ):
                        print("queued task %s" % task["taskid"])
                        worker = self._db["workers"].find_and_modify(
                            {
                                "state": "idle",
                                "providedsimtypes": {"$all": [task["simtype"]]}
                            },
                            update={
                                "$set": {
                                    "state": "chosen",
                                    "task": task["taskid"]
                                }
                            },
                            sort=[("priority", 1)]
                        )
                        if worker is None:
                            self._db["tasks"].update(
                                {"_id": task["_id"]},
                                {"$set": {"state": "queued"}}
                            )
                        else:
                            print("queued for worker %s" % worker["workerid"])
                    else:
                        self._db["tasks"].update(
                            {"_id": task["_id"]},
                            {"$set": {"state": "missing_parameter"}}
                        )

                worker = self._db["workers"].find_one({"workerid": workerid})
                if worker is not None and worker["task"] is not None:
                    yield bytes(
                        json.dumps(
                            {"taskid": worker["task"]},
                            cls=JSONEncoder
                        ),
                        "utf-8"
                    )
                    return
                if worker is not None and worker["state"] == "offline":
                    return

                yield "\n"
                time.sleep(1)
                count += 1

        return handler(self, workerid)

    waitforwork._cp_config = {'response.stream': True}

    @cherrypy.expose
    def setstate(self, workerid, state, progress=None, task=None):
        worker = self._db["workers"].find_one({"workerid": workerid})
        if worker is not None:
            self._db["workers"].update(
                {"workerid": workerid},
                {
                    "$set": {
                        "state": state,
                        "progress": progress,
                        "task": task,
                        "lastcontact": time.time()
                    }
                }
            )
            return jssuccess()
        return jsdeny()

    @cherrypy.expose
    def gettask(self, workerid, taskid):
        worker = self._db["workers"].find_one({"workerid": workerid})
        if worker is not None:
            task = self._db["tasks"].find_one({"taskid": taskid})
            if task is not None:
                return jssuccess(task=task)
            return jsfail()
        return jsdeny()

    @cherrypy.expose
    def getenv(self, workerid):
        worker = self._db["workers"].find_one({"workerid": workerid})
        if worker is not None:
            env = list(self._db["envfiles"].find())
            for item in env:
                item.pop("_id")
            return jssuccess(env=env)
        return jsdeny()

    @cherrypy.expose
    def getenvfile(self, workerid, kind, name):
        worker = self._db["workers"].find_one({"workerid": workerid})
        if worker is not None:
            file = self._db["envfiles"].find_one({"kind": kind, "name": name})
            if file is not None:
                fname = os.path.abspath(
                    os.path.join(config["simenv"]["envdir"], file["fname"])
                )
                return serve_file(
                    fname,
                    "application/octet-stream",
                    'attachment',
                    name
                )
            raise HTTPError("404 Not Found")
        raise HTTPError("403 Forbidden")

    @cherrypy.expose
    def scanenv(self, username=None, password=None):
        if username is None and password is None:
            user = self.getUser()
        else:
            user = self._db["users"].find_one({"username": username})
            if user is not None:
                if "pwsalt" in user and "pwhash" in user:
                    if not checkpassword(
                            password,
                            user["pwsalt"],
                            user["pwhash"]
                    ):
                        user = None
        if user is not None and user["permissions"].get("admin", False):
            self._db["envfiles"].remove()
            for file in recursivelistdir(config["simenv"]["envdir"]):
                elm = {
                    "fname": os.path.relpath(file, config["simenv"]["envdir"]),
                    "hash": hashfile(file),
                    "size": os.stat(file).st_size,
                }
                elm["name"] = os.path.basename(elm["fname"])
                elm["kind"] = os.path.dirname(elm["fname"])
                self._db["envfiles"].insert(elm)
            return jssuccess(files=list(self._db["envfiles"].find()))
        return jsdeny()


application = startapp(WorkerSrv)
