'''
   GeoPeril - A platform for the computation and web-mapping of hazard specific
   geospatial data, as well as for serving functionality to handle, share, and
   communicate threat specific information in a collaborative environment.

   Copyright (C) 2013 GFZ German Research Centre for Geosciences

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

     http://apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the Licence is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the Licence for the specific language governing permissions and
   limitations under the Licence.

   Contributors:
   Johannes Spazier (GFZ) - initial implementation
   Sven Reissland (GFZ) - initial implementation
   Martin Hammitzsch (GFZ) - initial implementation
'''

import time
import calendar
import subprocess
import math
import re
import os
import threading
import random
import binascii
import logging
import hashlib
import traceback
import json
import requests
import pymongo
import pandas
import owslib.wps as wps
from urllib.request import urlretrieve
from datetime import datetime
from datetime import timedelta
from pymongo.database import Database
from uuid import uuid4
from textwrap import wrap
from base64 import b64encode
from bson.objectid import ObjectId
import cherrypy
import surfer
from base import \
    checkpassword, createsaltpwhash, jsfail, \
    jsdeny, jssuccess, startapp, config
from basesrv import BaseSrv
from msgsrv import sendmail, sendtwilliosms

logger = logging.getLogger("WebguiSrv")

ARRIVALTIMES_DEFAULT_FILE = "arrivaltimes_default.geojson"
ARRIVALTIMES_RAW_FILE = "arrivaltimes.tiff"
WAVEHEIGHTS_DEFAULT_FILE = "waveheights_default.geojson"
WAVEHEIGHTS_RAW_FILE = "waveheights.tiff"
POISWAVEHEIGHTS_FILE = "pois.csv"


class WebGuiSrv(BaseSrv):
    DATE_PATTERN = r"%Y-%m-%dT%H:%M:%S.%fZ"

    @cherrypy.expose
    def supported_plugins(self):
        supported = {
            'compute': True,
        }
        return jssuccess(plugins=supported)

    @cherrypy.expose
    def session(self):
        user = self.getUser()
        if user is not None:
            userret = self._get_user_obj(user)
            return jssuccess(user=userret)
        return jsfail()

    @cherrypy.expose
    @cherrypy.tools.allow(methods=['POST'])
    def signin(self, username, password):
        user = self._db["users"].find_one({"username": username})
        if user is not None:
            if "pwsalt" in user and "pwhash" in user:
                res = checkpassword(password, user["pwsalt"], user["pwhash"])
            else:
                res = user["password"] == b64encode(
                    hashlib.new("sha256", bytes(password, "utf-8"))
                    .digest()
                ).decode("ascii")
                if res:
                    # updating login data
                    pwsalt, pwhash = createsaltpwhash(password)
                    self._db["users"].update(
                        {"username": user["username"]},
                        {"$set": {"pwsalt": pwsalt, "pwhash": pwhash}}
                    )
            if res:
                sessionid = str(uuid4())
                while self._db["users"].find_one(
                    {"session": sessionid}
                ) is not None:
                    sessionid = str(uuid4())
                self._db["users"].update(
                    {"username": user["username"]},
                    {"$set": {"session": sessionid}}
                )
                cookie = cherrypy.response.cookie
                cookie['server_cookie'] = sessionid
                cookie['server_cookie']['path'] = '/'
                cookie['server_cookie']['max-age'] = 3600
                cookie['server_cookie']['version'] = 1
                userObj = self._get_user_obj(user)
                return jssuccess(user=userObj)
        return jsfail()

    @cherrypy.expose
    def signout(self):
        user = self.getUser()
        if user is not None:
            self._db["users"].update(
                {"username": user["username"]},
                {"$set": {"session": None}}
            )
            cookie = cherrypy.response.cookie
            cookie['server_cookie'] = ""
            cookie['server_cookie']['path'] = '/'
            cookie['server_cookie']['max-age'] = 0
            cookie['server_cookie']['version'] = 1
            return jssuccess()
        return jsfail()

    @cherrypy.expose
    @cherrypy.tools.allow(methods=['POST'])
    def register(self, username, password, inst=None):
        user = self.getUser()

        if user is None or not user["permissions"].get("admin", False):
            return jsdeny()

        username = str(username)
        password = str(password)

        instId = None

        if inst is not None:
            find = self._db["institutions"].find_one({"name": str(inst)})
            if find is not None:
                instId = find.get("_id")

        if self._db["users"].find_one({"username": username}) is not None:
            return jsfail(errors=["User already exists."])

        salt, pwhash = createsaltpwhash(password)
        newuser = {
            "username": username,
            "password": b64encode(
                hashlib.new("sha256", bytes(password, "utf-8"))
                .digest()
            ).decode("ascii"),
            "pwsalt": salt,
            "pwhash": pwhash,
            "session": None,
            "inst": instId,
            "permissions": {
                # can change permission, create users, change users
                "admin": False,
                # can send internal messages
                "intmsg": False,
                # can send fax messages
                "fax": False,
                # can send mails
                "mail": False,
                # can send sms messages
                "sms": False,
                # can send messages to ftp/gts
                "ftp": False,
                # can create share links
                "share": False,
                # can compute simulations
                "comp": False,
                # can manage their institution
                "manage": False,
                # can view charts with sealevel data
                "chart": False,
                # can use timeline
                "timeline": False
            },
            "properties": {
                "InterfaxUsername": "",
                "InterfaxPassword": "",

                "TwilioSID": "",
                "TwilioToken": "",
                "TwilioFrom": "",

                "FtpHost": "",
                "FtpPort": 21,
                "FtpPath": "",
                "FtpUser": "anonymous",
                "FtpPassword": "anonymous",
            },
        }

        if inst is not None and \
                self._db["institutions"] \
                .find_one({"name": inst}) is None:
            self._db["institutions"].insert({
                "name": inst, "secret": None
            })

        self._db["users"].insert(newuser)
        newuser.pop("password")
        newuser.pop("pwsalt")
        newuser.pop("pwhash")

        return jssuccess(user=newuser)

    @cherrypy.expose
    def instlist(self):
        user = self.getUser()
        if user is not None and user["permissions"].get("admin", False):
            insts = list(self._db["institutions"].find())
            return jssuccess(institutions=insts)
        return jsdeny()

    @cherrypy.expose
    @cherrypy.tools.allow(methods=['POST'])
    def saveinst(self, instobj):
        user = self.getUser()
        if user is not None and user["permissions"].get("admin", False):
            instobj = json.loads(instobj)
            if self._db["institutions"] \
                    .find_one({"name": instobj["name"]}) is None:
                self._db["institutions"].insert(instobj)
            else:
                instobj.pop("_id")
                self._db["institutions"].update(
                    {"name": instobj["name"]},
                    {"$set": instobj}
                )
            instobj = self._db["institutions"].find_one({
                "name": instobj["name"]
            })
            return jssuccess(institution=instobj)
        return jsdeny()

    @cherrypy.expose
    @cherrypy.tools.allow(methods=['POST'])
    def delinst(self, name):
        user = self.getUser()
        if user is not None and user["permissions"].get("admin", False):
            if self._db["institutions"].find_one({"name": name}) is not None:
                self._db["institutions"].remove({"name": name})
                return jssuccess()
            return jsfail(errors=["Institution does not exist."])
        return jsdeny()

    @cherrypy.expose
    def userlist(self):
        user = self.getUser()
        if user is not None and user["permissions"].get("admin", False):
            users = list(self._db["users"].find())
            for user in users:
                user.pop("password", None)
                user.pop("pwhash", None)
                user.pop("pwsalt", None)
            return jssuccess(users=users)
        return jsdeny()

    @cherrypy.expose
    @cherrypy.tools.allow(methods=['POST'])
    def saveuser(self, userobj):
        user = self.getUser()
        if user is not None and user["permissions"].get("admin", False):
            userobj = json.loads(userobj)
            if "_id" in userobj:
                # all IDs have to be translated into the ObjectId type,
                # because they are only Strings in JS :(
                userid = ObjectId(userobj.pop("_id", None))
                if userobj["inst"] is not None:
                    userobj["inst"] = ObjectId(userobj["inst"])
                userobj.pop("pwsalt", None)
                userobj.pop("pwhash", None)
                if "password" in userobj:
                    if len(userobj["password"]) > 3:
                        userobj["pwsalt"], userobj["pwhash"] = \
                            createsaltpwhash(userobj["password"])
                        userobj["password"] = b64encode(
                            hashlib.new(
                                "sha256",
                                bytes(userobj["password"], "utf-8")
                            ).digest()
                        ).decode("ascii")
                    else:
                        userobj.pop("password", None)
                self._db["users"].update({"_id": userid}, {"$set": userobj})
                userobj = self._db["users"].find_one({"_id": userid})
                userobj.pop("password", None)
                userobj.pop("pwsalt", None)
                userobj.pop("pwhash", None)
                return jssuccess(user=userobj)
            return jsfail(errors=["User not found."])
        return jsdeny()

    @cherrypy.expose
    @cherrypy.tools.allow(methods=['POST'])
    def deluser(self, username):
        user = self.getUser()
        if user is not None and user["permissions"].get("admin", False):
            if self._db["users"].find_one({"username": username}) is not None:
                self._db["users"].remove({"username": username})
                return jssuccess()
            return jsfail(errors=["User does not exist."])
        return jsdeny()

    @cherrypy.expose
    def stationlist(self, inst=None):
        user = self.getUser()
        if user is not None:
            res = []
            if inst is None:
                stations = self._db["stations"].find()
            else:
                stations = self._db["stations"].find({"inst": inst})
            for station in stations:
                res.append(station)
            isotime = datetime.utcnow().strftime(self.DATE_PATTERN)
            return jssuccess(stations=res, serverTime=isotime)
        return jsdeny()

    @cherrypy.expose
    @cherrypy.tools.allow(methods=['POST'])
    def savestation(self, name=None, station=None):
        user = self.getUser()
        inst = self._db["institutions"].find_one({"_id": user["inst"]})["name"]
        if user is not None and user["permissions"].get("manage", False):
            if station is not None and "name" in station:
                station["inst"] = inst
                station["lastmetadataupdate"] = int(time.time())
                if name is None:
                    nostation = self._db["stations"].find_one({
                        "inst": inst, "name": station["name"]
                    })
                    if nostation is None:
                        self._db["stations"].insert(station)
                    else:
                        return jsfail(
                            errors=[
                                "Station named %s already exists."
                                % station["name"]
                            ]
                        )
                else:
                    self._db["stations"].update(
                        {"inst": inst, "name": name},
                        {"$set": station}
                    )
                station = self._db["stations"].find_one({
                    "inst": inst, "name": station["name"]
                })
                return jssuccess(station=station)
            if station is None and name is not None:
                self._db["stations"].remove({"inst": inst, "name": name})
                return jssuccess()
            return jsfail(errors=["Either station or name is required."])
        return jsdeny()

    @cherrypy.expose
    def getdata(self, station, start, end=None, inst=None):
        user = self.getUser()
        if user is not None:
            if inst is None:
                inst = self._db["institutions"].find_one({
                    "_id": user["inst"]
                })["name"]
            start = calendar.timegm(
                datetime.strptime(start, self.DATE_PATTERN).timetuple()
            )
            if end is not None:
                end = calendar.timegm(
                    datetime.strptime(end, self.DATE_PATTERN).timetuple()
                )
            else:
                end = time.mktime(datetime.now().timetuple())
            request = {
                "inst": inst,
                "station": station,
                "timestamp": {"$gt": start, "$lte": end}
            }
            self._db["sealeveldata"].ensure_index(
                [("inst", 1), ("station", 1), ("timestamp", 1)]
            )
            values = self._db["sealeveldata"]. \
                find(request).sort("timestamp", 1)
            res = {"data": [], "last": None}
            for val in values:
                if res["last"] is None or res["last"] < val["timestamp"]:
                    res["last"] = val["timestamp"]
                res["data"].append(
                    (
                        datetime.utcfromtimestamp(
                            val["timestamp"]
                        ).strftime(self.DATE_PATTERN),
                        val["value"]
                    )
                )
            return jssuccess(station=station, **res)
        return jsdeny()

    @cherrypy.expose
    def getsimdata(self, evid, station, end=None, ff=1):
        user = self.getUser()

        if user is None:
            return jsdeny()

        if end is not None:
            end = calendar.timegm(
                datetime.strptime(end, self.DATE_PATTERN).timetuple()
            )
        else:
            end = time.mktime(datetime.now().timetuple())

        # fast forward parameter (acceleration)
        ff = max(int(ff), 1)

        evt = self._db["eqs"].find_one({
            "_id": evid
        })

        if (
            evt is None
            or evt.get("prop") is None
            or evt.get("prop").get("date") is None
        ):
            return jsfail(error="event has unknown datetime")

        start: datetime = evt.get("prop").get("date")
        starttimestamp = start.timestamp()

        if "resultsdir" not in evt:
            return jsfail(error="Could not get results for event")

        csvpath = os.path.join(
            evt["resultsdir"],
            POISWAVEHEIGHTS_FILE
        )

        if not os.path.isfile(csvpath):
            return jsfail(error="Could not get results file")

        res = {"data": [], "last": None}

        try:
            alldata = pandas.read_csv(csvpath)
        except Exception as ex:
            logger.error(traceback.format_exc())
            return jsfail(error="Could not read results file")

        minutes = alldata.get('Minute')
        simdata = alldata.get(station)

        if minutes is None:
            return jsfail()

        if simdata is None:
            # no data for station in the results available
            return jssuccess(station=station, **res)

        for i, value in enumerate(simdata):
            reltime = minutes[i] * 60

            if ff > 1:
                # TODO: check in context of acceleration
                newreltime = reltime // ff
                timestamp = timestamp + newreltime
            else:
                timestamp = starttimestamp + reltime

            if timestamp > end:
                break

            if res["last"] is None or res["last"] < timestamp:
                res["last"] = timestamp

            res["data"].append(
                (
                    datetime.utcfromtimestamp(
                        timestamp
                    ).strftime(self.DATE_PATTERN),
                    value
                )
            )
        return jssuccess(station=station, **res)

    @cherrypy.expose
    def getcomp(self, evid, kind):
        user = self.getUser()
        if user is not None or self.auth_shared(evid):
            if kind == "CFZ":
                res = self._getcfzs(evid)
            else:
                res = list(self._db["comp"].find({
                    "EventID": evid, "type": kind
                }))
            return jssuccess(comp=res)
        return jsdeny()

    def _getcfzs(self, evid):
        res = list(self._db["comp"].find({"EventID": evid, "type": "CFZ"}))
        for one in res:
            cfz = self._db["cfcz"].find_one(
                {"FID_IO_DIS": one["code"]},
                {"_COORDS_": 0}
            )
            one.update(cfz)
        return res

    @cherrypy.expose
    def getoois(self, evid, kind):
        user = self.getUser()
        if user is not None or self.auth_shared(evid):
            res = list(self._db["oois"].find({"type": kind}))
            return jssuccess(objs=res)
        return jsdeny()

    @cherrypy.expose
    def getbuildings(self, minx, miny, maxx, maxy, evtid=None):
        user = self.getUser()
        if user is not None:
            return jssuccess(
                buildings=self._getbuildings(minx, miny, maxx, maxy, evtid)
            )
        return jsdeny()

    def _getbuildings(self, minx, miny, maxx, maxy, evtid=None):
        query = {}
        if maxy is not None:
            # does not consider the wrap around +180/-180 degree longitude
            query = {"$and": [
                {"minx": {"$gt": float(minx)}},
                {"miny": {"$gt": float(miny)}},
                {"maxx": {"$lt": float(maxx)}},
                {"maxy": {"$lt": float(maxy)}}
            ]}
        res = list(self._db["osm_buildings"].find(query).limit(3000))
        if evtid is not None:
            fgrid = os.path.join(
                config["eventdata"]["eventdatadir"],
                evtid,
                "wstmax_gpu.grid"
            )
            if os.path.isfile(fgrid):
                file = open(fgrid, "rb")
                sfile = surfer.SurferFile(file)
                for building in res:
                    building["height"] = max(
                        sfile.getValueAtLatLon(
                            building["miny"], building["minx"], 0
                        ),
                        sfile.getValueAtLatLon(
                            building["miny"], building["maxx"], 0
                        ),
                        sfile.getValueAtLatLon(
                            building["maxy"], building["minx"], 0
                        ),
                        sfile.getValueAtLatLon(
                            building["maxy"], building["maxx"], 0
                        ),
                        0
                    )
                file.close()
            else:
                print("grid file not found!")
        return res

    @cherrypy.expose
    def getjets(self, evid):
        # TODO additional parameters for getting different wavejet outputs
        user = self.getUser()

        if user is not None or self.auth_shared(evid):
            evt = self._db["eqs"].find_one({
                "_id": evid
            })

            if evt is None or "resultsdir" not in evt:
                return jsfail(error="Could not get results for event")

            default = os.path.join(
                evt["resultsdir"],
                WAVEHEIGHTS_DEFAULT_FILE
            )

            if not os.path.isfile(default):
                return jsfail(error="Could not get default output file")

            with open(default) as json_file:
                res = json.load(json_file)

            return jssuccess(jets=res)
        return jsdeny()

    @cherrypy.expose
    def getwaterheights(self, evid):
        user = self.getUser()
        if user is not None or self.auth_shared(evid):
            heights = list(
                self._db["comp"].find({
                    "id": evid, "type": "FLOOD"
                }).sort([("height", 1)])
            )
            for height in heights:
                if height["height"] == "1":
                    height["color"] = "#fdfd01"
                if height["height"] == "3":
                    height["color"] = "#ff6100"
                if height["height"] == "5":
                    height["color"] = "#f50000"
            return jssuccess(heights=heights)
        return jsdeny()

    @cherrypy.expose
    def getisos(self, evid):
        # TODO additional parameters for getting different arrivaltime outputs
        user = self.getUser()

        if user is not None or self.auth_shared(evid):
            evt = self._db["eqs"].find_one({
                "_id": evid
            })

            if evt is None or "resultsdir" not in evt:
                return jsfail(error="Could not get results for event")

            default = os.path.join(
                evt["resultsdir"],
                ARRIVALTIMES_DEFAULT_FILE
            )

            if not os.path.isfile(default):
                return jsfail(error="Could not get default output file")

            with open(default) as json_file:
                res = json.load(json_file)

            return jssuccess(isos=res)
        return jsdeny()

    @cherrypy.expose
    def gettfps(self, evid):
        user = self.getUser()
        if user is not None or self.auth_shared(evid):
            res = self._gettfps(evid)
            return jssuccess(comp=res)
        return jsdeny()

    # for internal use
    def _gettfps(self, evid):
        crs = list(self._db["comp"].find({"EventID": evid, "type": "TFP"}))
        res = []
        for tfp in crs:
            obj = self._db["tfps"].find_one({"_id": ObjectId(tfp["tfp"])})
            if obj is None:
                continue
            obj["ewh"] = tfp["ewh"]
            obj["eta"] = tfp["eta"]
            res.append(obj)
        return res

    # static division into different TFP levels
    def get_tfp_level(self, tfp):
        if tfp["eta"] == -1:
            return None
        if tfp["ewh"] < 0.2:
            return "INFORMATION"
        if tfp["ewh"] < 0.5:
            return "ADVISORY"
        return "WATCH"

    @cherrypy.expose
    def get_msg_texts(self, evtid, kind, form=None):
        user = self.getUser()
        if user is not None:
            if form == "caribe":
                msgs = self._get_msg_texts_caribe(evtid, kind, user)
            else:
                msgs = self._get_msg_texts(evtid, kind, user)
            return jssuccess(**msgs)
        return jsdeny()

    # auxillary function to indent a multiline string
    def _indent(self, val, count=4):
        return re.sub("^", " "*count, val, flags=re.M)

    # auxillary function that removes duplicates while preserving order and
    # formats the output as needed
    # set s is only allocated once which allows to exclude already matched
    # elements in subsequent invocations
    # pass set() to use a fresh empty set
    def _layout(self, lst, matched=set()):
        return self._indent(
            "\n".join(
                wrap(
                    "... ".join([
                        x for x in [v["country"].upper() for v in lst]
                        if not (x in matched or matched.add(x))
                    ]),
                    55
                )
            ),
            6
        )

    def _select(self, val, arr, lst):
        return arr[
            [x for x in lst if x in arr and lst.index(val) <= lst.index(x)][0]
        ]

    def _fselect(self, step, arr):
        return self._select(step, arr, ["end", "mid", "first"])

    def _replace_dots(self, arr):
        return arr["data"]["time"].replace(".", "").replace(":", "")

    def _get_msg_texts_caribe(self, evid, kind, user=None):
        eqs = self._db["eqs"].find_one({"_id": evid})
        template = self._db["settings"].find_one({
            "type": "msg_template_caribe"
        })
        # check previous message
        msgnr = 1
        now = eqs["prop"]["date"] + (
            datetime.utcnow() - eqs["prop"]["date"]
        ) * 1
        rootid = eqs["root"] if eqs["root"] else eqs["_id"]
        cursor = self._db["messages_sent"].find({
            "EventID": rootid,
            "SenderID": user["_id"],
            "NextMsgNr": {"$ne": None}
        }).sort("CreatedTime", -1).limit(1)
        prev_msg = cursor[0] if cursor.count() > 0 else None
        if prev_msg:
            msgnr = prev_msg["NextMsgNr"] + 1

        # create location table
        # get all TFPs with a real ETA value
        tfps = sorted(
            [v for v in self._gettfps(evid) if v["eta"] > -1],
            key=lambda x: x["eta"]
        )
        tfp_text = ""
        if tfps:
            len_location = max(max([len(v["name"]) for v in tfps]), 8)
            len_region = max(max([len(v["country"]) for v in tfps]), 6)

            tfp_text += "%s  %s   %s    %s \n" % (
                "LOCATION".ljust(len_location),
                "REGION".ljust(len_region),
                "COORDINATES", "ETA(UTC)"
            )
            tfp_text += "\n".rjust(len(tfp_text), "-")
            for tfp in tfps:
                arr_min = math.floor(tfp["eta"])
                arr_sec = math.floor((tfp["eta"] % 1) * 60.0)
                arr_time = eqs["prop"]["date"] + timedelta(
                    minutes=arr_min,
                    seconds=arr_sec
                )
                # if arr_time < now:
                #     continue
                tfp_text += "%s  %s  %4.1f%c %5.1f%c   %s\n" % (
                    tfp["name"].ljust(len_location),
                    tfp["country"].ljust(len_region),
                    abs(tfp["lat_real"]),
                    "S" if tfp["lat_real"] < 0 else "N",
                    abs(tfp["lon_real"]),
                    "W" if tfp["lon_real"] < 0 else "E",
                    arr_time.strftime("%H%M %m/%d")
                )
            tfp_text = self._indent(tfp_text)

        # create threat categories
        # get all CFZs with a real ETA value and create a new field "country"
        # which is equivalent to the existing field "COUNTRY"
        cfzs = [
            (v if v.update({"country": v["COUNTRY"]}) is None else None)
            for v in self._getcfzs(evid) if v["eta"] > -1
        ]
        etas = sorted(tfps + cfzs, key=lambda x: x["eta"])
        ewhs = sorted(tfps + cfzs, key=lambda x: x["ewh"])

        levels = {}
        levels["watch"] = self._layout([v for v in ewhs if v["ewh"] > 3])
        levels["advisory"] = self._layout(
            [v for v in ewhs if v["ewh"] > 1 and v["ewh"] <= 3]
        )
        levels["info"] = self._layout(
            [v for v in ewhs if v["ewh"] > 0.3 and v["ewh"] <= 1]
        )
        threat = self._layout(etas, set())

        # create table of gauge locations
        gauge_text = ""
        has_initial_gauges = False
        has_new_gauges = False
        if user is not None:
            pickings = sorted(
                list(
                    self._db["pickings"].find({
                        "userid": user["_id"],
                        "evtid": evid,
                        "data.pick": True
                    })
                ),
                key=self._replace_dots,
                reverse=True
            )
            for picking in pickings:
                picking["station_obj"] = self._db["stations"].find_one({
                    "name": picking["station"]
                })
            if pickings:
                len_location = max(
                    max([len(v["station_obj"]["name"]) for v in pickings]),
                    14
                )
                gauge_text += \
                    "%s     GAUGE      TIME OF   MAXIMUM     WAVE\n" % \
                    "".ljust(len_location)
                gauge_text += \
                    "%s  COORDINATES   MEASURE   TSUNAMI   PERIOD\n" % \
                    "".ljust(len_location)
                gauge_text += \
                    "%s   LAT   LON     (UTC)     HEIGHT    (MIN)\n" % \
                    "GAUGE LOCATION".ljust(len_location)
                gauge_text += "\n".rjust(
                    len(gauge_text.split("\n")[0]) + 1, "-"
                )
                has_initial_gauges = not prev_msg or not [
                    v for v in pickings
                    if prev_msg["CreatedTime"] > v["modified"]
                ]
                has_new_gauges = prev_msg and [
                    v for v in pickings
                    if v["modified"] > prev_msg["CreatedTime"]
                ] and not has_initial_gauges
            for picking in pickings:
                station = picking["station_obj"]
                gauge_text += \
                    "%s  %4.1f%c %5.1f%c    %s  %5.2fM/%4.1fFT %3d \n" % (
                        station["name"].ljust(len_location),
                        abs(station["lat"]),
                        "S" if station["lat"] < 0 else "N",
                        abs(station["lon"]),
                        "W" if station["lon"] < 0 else "E",
                        picking["data"]["time"].replace(":", ""),
                        picking["data"]["ampl"],
                        picking["data"]["ampl"] * 3.28084,
                        picking["data"]["period"]
                    )
            if pickings:
                gauge_text = template["observations"] % \
                    self._indent(gauge_text)
        ##
        step = "end" if kind == "end" else "mid" if msgnr > 1 else "first"

        # find previous magnitude
        mag = eqs["prop"]["magnitude"]
        prev_mag = self._db["eqs"].find_one({
            "_id": prev_msg["ParentId"]
        })["prop"]["magnitude"] if prev_msg else None

        msg = template["header"] % (
            msgnr,
            now.strftime("%H%M UTC ON %a %b %d %Y").upper(),
            "FINAL " if step == "end" else ""
        )
        updates = ""
        if prev_mag and prev_mag != mag:  # if magnitude changes
            updates += template["updates_mag"] % (
                "REVISED" if mag > prev_mag else "REDUCED",
                prev_mag,  # previous magnitude
                mag  # current magnitude
            )
        if msgnr == 2:
            updates += template["updates_ampl"]
        if step == "end":
            updates += template["updates_final"]
        if has_initial_gauges:  # if gauge locations the first time
            updates += template["updates_obs_incl"]
        if has_new_gauges:  # if gauge locations updated
            updates += template["updates_obs_up"]
        msg += template["updates"] % updates if updates else ""
        msg += template["params"] % (
            eqs["prop"]["magnitude"],
            eqs["prop"]["date"].strftime("%H%M UTC %b %d %Y").upper(),
            abs(eqs["prop"]["latitude"]),
            "SOUTH" if eqs["prop"]["latitude"] < 0 else "NORTH",
            abs(eqs["prop"]["longitude"]),
            "WEST" if eqs["prop"]["longitude"] < 0 else "EAST",
            eqs["prop"]["depth"],
            eqs["prop"]["depth"] * 0.621371,
            eqs["prop"]["region"]
        )
        msg += self._fselect(step, template["eval"]) % (
            template["eval_params"] % (
                eqs["prop"]["magnitude"],
                eqs["prop"]["region"],
                eqs["prop"]["date"].strftime("%H%M UTC ON %A %B %d %Y").upper()
            ),
            template["eval_observed"] if msgnr >= 3 else ""
        )
        if step == "mid":
            msg += self._fselect(step, template["threat"]) % (
                template["threat_watch"] % levels["watch"] + "\n\n" +
                template["threat_advisory"] % levels["advisory"] + "\n\n" +
                template["threat_info"] % levels["info"]
            )
        else:
            msg += self._fselect(step, template["threat"]) % threat
        msg += self._fselect(step, template["recommended"])
        msg += self._fselect(step, template["arrival"])
        if step != "end":
            msg += tfp_text + "\n\n"
        msg += self._fselect(step, template["impact"])
        msg += gauge_text
        msg += self._fselect(step, template["next_update"])

        # build SMS text
        sms = "*TEST*EXPERIMENTAL TSUNAMI MESSAGE;"
        sms += "NWS PACIFIC TSUNAMI WARNING CENTER;"
        sms += "%s;EQ Mw%.1f;%s;%.2f%c;%.2f%c;%uKM;*TEST*" % (
            eqs["prop"]["date"].strftime("%H%MZ %d%b%Y").upper(),
            eqs["prop"]["magnitude"],
            eqs["prop"]["region"],
            abs(eqs["prop"]["latitude"]),
            "S" if eqs["prop"]["latitude"] < 0 else "N",
            abs(eqs["prop"]["longitude"]),
            "W" if eqs["prop"]["longitude"] < 0 else "E",
            eqs["prop"]["depth"]
        )
        return {"mail": msg, "sms": sms, "msgnr": msgnr}

    def _format_country(self, arr):
        return arr["country"] + " - " + arr["name"]

    def _format_country_state(self, arr):
        return arr["COUNTRY"] + (
            " - " + arr["STATE_PROV"] if arr["STATE_PROV"] else ""
        )

    def _get_msg_texts(self, evid, kind, user=None):
        tfps = self._gettfps(evid)
        cfzs = self._getcfzs(evid)
        # get earthquake event
        eqs = self._db["eqs"].find_one({"_id": evid})
        # define headlines
        headlen = 0
        # ISO-2 map used to build the SMS text later on - initialize given
        # keys with empty sets
        iso_map = {key: set() for key in ["WATCH", "ADVISORY", "INFORMATION"]}
        # pick up neccessary data
        data = {}
        # define maximal size of TFP or zone name
        maxsize = 30
        for tfp in tfps:
            level = self.get_tfp_level(tfp)
            if level is None:
                continue
            # add new key if not already present
            if level not in data:
                data[level] = {}
            # add new key if not already present
            if tfp["country"] not in data[level]:
                data[level][tfp["country"]] = []
            data[level][tfp["country"]].append(tfp)
            headlen = max(headlen, len(self._format_country(tfp)))
            # add short ISO-2 country name to set
            # duplicates are avoided this way
            iso_map[level].add(tfp["iso_2"])

        headlen = min(headlen, maxsize)
        headlines = (
            "LOCATION-FORECAST POINT".ljust(headlen),
            "COORDINATES   ",
            "ARRIVAL TIME",
            "LEVEL       "
        )
        headlen = len(headlines[0])
        tfp_txt = "%s %s %s %s\n" % headlines
        for head in headlines:
            tfp_txt += "%s " % "".ljust(len(head), '-')
        tfp_txt += "\n"

        # iterate levels WATCH and ADVISORY only if available - the sorting is
        # done using the length of the level names (WATCH, ADVISORY,
        # INFORMATION)
        for level in sorted(
                data.keys() & ["WATCH", "ADVISORY"],
                key=len
        ):
            # sort items in country lists
            for country_map in data[level].values():
                country_map.sort(key=lambda x: x["eta"])
            # iterate items sorted by country ...
            for country_map in sorted(
                    data[level].values(),
                    key=lambda x: x[0]["eta"]
            ):
                # ... and ETA value
                for item in country_map:
                    arr_min = math.floor(item["eta"])
                    arr_sec = math.floor((item["eta"] % 1) * 60.0)
                    arrival = eqs["prop"]["date"] + timedelta(
                        minutes=arr_min,
                        seconds=arr_sec
                    )
                    label = self._format_country(item)
                    if len(label) > maxsize:
                        tfp_txt += label + "\n"
                        label = ""
                    tfp_txt += (
                        "%.*s %5.2f%c %6.2f%c %s %s\n"
                        % (
                            maxsize,
                            label.ljust(headlen),
                            abs(item["lat_real"]),
                            "S" if item["lat_real"] < 0 else "N",
                            abs(item["lon_real"]),
                            "W" if item["lon_real"] < 0 else "E",
                            arrival.strftime("%H%MZ %d %b").upper(),
                            level
                        )
                    )
            tfp_txt += "\n"

        maxsize = 45
        # remove all CFZs with an ETA value of -1
        cfzs = [v for v in cfzs if v["eta"] > -1]
        if cfzs:
            vmax = max(cfzs, key=lambda x: len(self._format_country_state(x)))
            headlen = min(len(self._format_country_state(vmax)), maxsize)
            headlines = (
                "LOCATION-FORECAST ZONE".ljust(headlen),
                "ARRIVAL TIME",
                "LEVEL       "
            )
            headlen = len(headlines[0])
            # print headlines
            cfz_txt = "%s %s %s\n" % headlines
            for head in headlines:
                cfz_txt += "%s " % "".ljust(len(head), '-')
            cfz_txt += "\n"

            for cfz in sorted(cfzs, key=lambda x: x["eta"]):
                level = self.get_tfp_level(cfz)
                arr_min = math.floor(cfz["eta"])
                arr_sec = math.floor((cfz["eta"] % 1) * 60.0)
                arrival = eqs["prop"]["date"] + timedelta(
                    minutes=arr_min,
                    seconds=arr_sec
                )
                label = self._format_country_state(cfz)
                if len(label) > maxsize:
                    cfz_txt += label + "\n"
                    label = ""
                cfz_txt += (
                    "%.*s %s %s\n" % (
                        maxsize,
                        label.ljust(headlen),
                        arrival.strftime("%H%MZ %d %b").upper(),
                        level
                    )
                )
                # used in SMS generation later on
                iso_map[level].add(cfz["ISO2"])
            cfz_txt += "\n"

        #
        applies = {}
        countries = []
        for level in sorted(data, key=len):
            applies[level] = ""
            for country in sorted(data[level].keys()):
                if level != "INFORMATION" or country not in countries:
                    applies[level] += "%s ... " % country
                    countries.append(country)
            applies[level] = applies[level][:-5]

        # get message template
        template = self._db["settings"].find_one({"type": "msg_template"})

        msgnr = 1
        provider = ""
        if user is not None:
            # find next message number
            rootid = eqs["root"] if eqs["root"] else eqs["_id"]
            cursor = self._db["messages_sent"].find({
                "EventID": rootid,
                "SenderID": user["_id"],
                "NextMsgNr": {"$ne": None}
            }).sort("CreatedTime", -1).limit(1)
            if cursor.count() > 0:
                msgnr = cursor[0]["NextMsgNr"] + 1
            # get tsunami provider from institution settings
            if "inst" in user:
                inst = self._db["institutions"].find_one({"_id": user["inst"]})
                if inst is not None:
                    provider += inst["msg_name"]
        else:
            provider = template["provider"]
        # build final message
        msg = template["prolog"] % (
            msgnr,
            provider,
            datetime.utcnow().strftime("%H%MZ %d %b %Y").upper()
        )
        # summaries
        for level in sorted(data, key=len):
            if level == "INFORMATION" and kind == "end":
                continue
            if applies[level] != "":
                msg += template["summary"] % (
                    "END OF " if kind == "end" else "",
                    level,
                    " CANCELLATION" if kind == "cancel" else (
                        " ONGOING" if msgnr > 1 and kind == "info" else ""
                    ),
                    applies[level]
                )
        msg += template["advise"]
        msg += template["params"] % (
            eqs["prop"]["date"].strftime("%H%MZ %d %b %Y").upper(),
            abs(eqs["prop"]["latitude"]),
            "SOUTH" if eqs["prop"]["latitude"] < 0 else "NORTH",
            abs(eqs["prop"]["longitude"]),
            "WEST" if eqs["prop"]["longitude"] < 0 else "EAST",
            eqs["prop"]["depth"],
            eqs["prop"]["region"],
            eqs["prop"]["magnitude"]
        )
        # measurements
        if user is not None and kind in ("info", "end"):
            text = ""
            pickings = list(
                self._db["pickings"].find({
                    "userid": user["_id"], "evtid": evid, "data.pick": True
                })
            )
            for picking in pickings:
                picking["station_obj"] = self._db["stations"].find_one({
                    "name": picking["station"]
                })
            if pickings:
                headlines = [
                    "COUNTRY",
                    "GAUGE LOCATION",
                    "LAT   ",
                    "LON    ",
                    "TIME ",
                    "AMPL  ",
                    "PER      "
                ]
                item = max(
                    pickings,
                    key=lambda x: len(x["station_obj"]["countryname"])
                )
                len_country = max(
                    len(headlines[0]),
                    len(item["station_obj"]["countryname"])
                )
                item = max(pickings, key=lambda x: len(x["station"]))
                len_location = max(len(headlines[1]), len(item["station"]))
                headlines[0] = headlines[0].ljust(len_country)
                headlines[1] = headlines[1].ljust(len_location)
                for head in headlines:
                    text += head + " "
                text += "\n"
                for head in headlines:
                    text += "%s " % "".ljust(len(head), '-')
                text += "\n"
            for picking in pickings:
                station = picking["station_obj"]
                text += "%s %s %5.2f%c %6.2f%c %sZ %5.2fM %6.2fMIN\n" % (
                    station["countryname"].upper().ljust(len_country),
                    station["name"].ljust(len_location),
                    abs(station["lat"]), "S" if station["lat"] < 0 else "N",
                    abs(station["lon"]), "W" if station["lon"] < 0 else "E",
                    picking["data"]["time"].replace(":", ""),
                    picking["data"]["ampl"],
                    picking["data"]["period"]
                )
            if pickings:
                msg += template["measurements"] % text
        # evaluation of WATCH, ADVISORY and INFORMATION
        if kind == "info":
            if msgnr == 1:
                msg += template["eval_watch_first"]
                msg += template["eval_advisory_first"]
                msg += template["eval_info_first"]
            else:
                msg += template["eval_watch_mid"]
                msg += template["eval_advisory_mid"]
        elif kind == "end":
            msg += template["eval_watch_end"]
            msg += template["eval_advisory_end"]

        # append table of TFP values if available
        if kind == "info":
            if "WATCH" in data or "ADVISORY" in data:
                msg += template["tfps"] % tfp_txt

        # append table of CFZ values if available
        if cfzs:
            msg += cfz_txt

        #
        if kind == "info":
            msg += template["supplement"]
        else:
            msg += template["final"]
        msg += template["epilog"] % msgnr

        # build SMS text
        sms = "*TEST*TSUNAMI EXERCISE MSG;"
        # TODO: make dynamic?
        sms += "NEAMTWS-GFZ;"
        for level in ["WATCH", "ADVISORY"]:
            if not iso_map[level]:
                continue
            sms += level + ":"
            for iso in iso_map[level]:
                if iso is not None:
                    sms += iso + " "
            sms = sms[:-1] + ";"
        sms += "%s;EQ Mw%.1f;%s;%.2f%c;%.2f%c;%uKM;*TEST*" % (
            eqs["prop"]["date"].strftime("%H%MZ %d%b%Y").upper(),
            eqs["prop"]["magnitude"],
            eqs["prop"]["region"],
            abs(eqs["prop"]["latitude"]),
            "S" if eqs["prop"]["latitude"] < 0 else "N",
            abs(eqs["prop"]["longitude"]),
            "W" if eqs["prop"]["longitude"] < 0 else "E",
            eqs["prop"]["depth"],
        )
        return {"mail": msg, "sms": sms, "msgnr": msgnr}

    # public interface to get all information about an earthquake event
    @cherrypy.expose
    def get_event_info(self, apikey, evid):
        if self.auth_api(apikey) is not None:
            cursor = self._db["eqs"].find({
                "$or": [{"_id": evid}, {"id": evid}]
            }).sort("refineId", -1).limit(1)
            if cursor.count() > 0:
                eqs = cursor[0]
                # set fields explicitly to avoid returning sensible data that
                # may be added later
                evt = {
                    "evid": eqs["_id"],
                    "geofonid": eqs["id"],
                    "prop": eqs["prop"],
                }
                if "process" in eqs:
                    evt["simulation"] = eqs["process"][0]
                    if "shared_link" in eqs:
                        evt["simulation"]["shared_link"] = \
                            self.get_hostname() + "/?share=" + \
                            str(eqs["shared_link"])
                        evt["simulation"]["image_url"] = \
                            self.get_hostname() + "/snapshots/" \
                            + str(eqs["shared_link"]) + ".png"

                msg = self._get_msg_texts(eqs['_id'], "info")["mail"]
                return jssuccess(eq=evt, msg=msg)
            return jsfail()
        return jsdeny()

    # create a shared link and return its ID - internal usage only
    def _make_shared_link(self, evtid, lon, lat, zoom, userid):
        obj = {
            "evtid": evtid,
            "lon": float(lon),
            "lat": float(lat),
            "zoom": int(zoom),
            "timestamp": datetime.utcnow(),
            "userid": userid
        }
        # return ID of inserted object
        return self._db["shared_links"].insert(obj)

    # public interface to create a shared link
    @cherrypy.expose
    def make_shared_link(self, evtid, lon, lat, zoom):
        user = self.getUser()
        if user is not None:
            link_id = self._make_shared_link(
                evtid, lon, lat, zoom, user["_id"]
            )
            return jssuccess(key=link_id)
        return jsdeny()

    # create a PNG image based on a shared link and return the file as binary
    # data
    def make_image(self, link_id):
        # call phantomjs to make a snapshot
        path = os.path.dirname(os.path.realpath(__file__)) + "/phantomjs/"
        # provide file for download
        dst = os.path.join(
            config["global"]["snapshotdir"], str(link_id) + '.png'
        )
        subprocess.call(
            path + "phantomjs " + path + "snapshot.js " + self.get_hostname() +
            "/?share=" + str(link_id) + " " + dst + " '#mapview'", shell=True
        )

    @cherrypy.expose
    def create_missing_images(self):
        events = self._db["eqs"].find({"shared_link": {"$ne": None}})
        for evt in events:
            dst = os.path.join(
                config["global"]["snapshotdir"],
                str(evt["shared_link"]) + '.png'
            )
            if not os.path.isfile(dst):
                print(
                    "create_missing_image for event " +
                    str(evt["_id"]) + " (" + str(evt["shared_link"]) + ")"
                )
                self.make_image(str(evt["shared_link"]))
        return jssuccess()

    def newRandomId(self, username):
        found = True

        while found:
            newid = username + "." + str(uuid4()).split("-")[0]
            obj1 = self._db["eqs"].find_one({"_id": newid})
            # TODO search in evtset too?
            found = (obj1 is not None)

        return newid

    def start_worker(
        self, worker, user, name, lat, lon, depth, dip, strike, rake, dur, mag,
        slip, length, width, date: datetime, gridres, algo, pois,
        existingId=None
    ):
        url = worker.get("wpsurl")
        process = worker.get("wpsprocess")

        if url is None or process is None:
            return jsfail(error="Missing configuration for worker")

        # TODO: start WPS request with owslib and monitor the execution in a
        # separate thread

        try:
            server = wps.WebProcessingService(url, version="1.0.0")
        except Exception as ex:
            logger.error(ex)
            return jsfail(error="Could not connect to WPS server")

        found = False

        for pro in server.processes:
            if pro.identifier == process:
                found = True
                break

        if not found:
            return jsfail(
                error="The WPS does not offer the configured process"
            )

        inputs = [
            ('lat', str(lat)),
            ('lon', str(lon)),
            ('depth', str(depth)),
            ('duration', str(dur)),
            ('date', date.strftime(self.DATE_PATTERN)),
            ('gridres', str(gridres)),
            ('dip', str(dip)),
            ('strike', str(strike)),
            ('rake', str(rake)),
        ]

        if slip is None:
            inputs.append(('mag', str(mag)))
        else:
            inputs.extend([
                ('slip', str(slip)),
                ('length', str(length)),
                ('width', str(width)),
            ])

        if pois is not None:
            inputs.append(('pois', str(pois)))

        execution = server.execute(
            identifier=process,
            inputs=inputs,
            output=[
                ('calctime', False),
                ('arrivaltimes', True),
                ('arrivaltimesRaw', True),
                ('waveheights', True),
                ('waveheightsRaw', True),
                ('poisWaveheights', True),
            ]
        )

        if existingId is None:
            newid = self.newRandomId(user["username"])
            # TODO: parent ?
            curTime = datetime.now()

            self._db["eqs"].insert_one({
                "_id": newid,
                "id": newid,
                "user": user["_id"],
                "timestamp": curTime,
                "progress": 0,
                "prop": {
                    "date": date,
                    "region": name,
                    "latitude": lat,
                    "longitude": lon,
                    "magnitude": mag,
                    "slip": slip,
                    "length": length,
                    "width": width,
                    "depth": depth,
                    "dip": dip,
                    "strike": strike,
                    "rake": rake,
                    "comp": dur,
                    "gridres": gridres,
                    "algo": algo
                }
                # TODO: root ?
                # TODO: parent ?
            })

            # TODO: really needed?
            self._db["events"].insert_one({
                "id": newid,
                "user": user["_id"],
                "timestamp": curTime,
                "event": "new"
            })

            evId = newid
        else:
            evId = existingId

        resultsdir = self._db["settings"].find_one({"type": "resultsdir"})

        if resultsdir is None or resultsdir.get("results") is None:
            return jsfail(error="Internal error: resultsdir not configured")

        inst = self._db["institutions"].find_one({"_id": user.get("inst")})

        thread = WatchExecution(
            self._db, execution, evId, resultsdir.get("results"),
            inst.get("name"), user.get("username"), worker
        )
        thread.start()

        return jssuccess()

    @cherrypy.expose
    def compute(self, **params):
        name = params.get("name")
        lat = params.get("lat")
        lon = params.get("lon")
        depth = params.get("depth")
        dip = params.get("dip")
        strike = params.get("strike")
        rake = params.get("rake")
        dur = params.get("dur")
        mag = params.get("mag")
        slip = params.get("slip")
        length = params.get("length")
        width = params.get("width")
        date = params.get("date")
        algo = params.get("algo")
        gridres = params.get("gridres")
        pois = params.get("pois")

        user = self.getUser()

        if user is None:
            return jsdeny()

        # TODO: distribute incoming requests evenly on workers
        # for example with index counter of last used worker in mongo DB
        # TODO: add exclusive worker for automated computation only
        # but should be a different function called by data_insert only

        if mag is None and (slip is None or length is None or width is None):
            return jsfail(
                error="Either magnitude or slip (with length and width) "
                + "is required"
            )

        if (
            name is None or lat is None or lon is None or depth is None
            or dur is None or date is None or algo is None or gridres is None
        ):
            return jsfail(error="Required parameters are missing")

        algo = algo.lower()

        if algo != "easywave" and algo != "hysea":
            return jsfail(error="Unknown algorithm")

        dateconv = datetime.strptime(date, self.DATE_PATTERN)

        if dateconv is None:
            return jsfail(error="Unknown date format")

        lat = float(lat)
        lon = float(lon)
        depth = float(depth)
        dur = int(dur)
        gridres = int(gridres)

        if mag is not None:
            mag = float(mag)

        if dip is not None:
            dip = int(dip)

        if strike is not None:
            strike = int(strike)

        if rake is not None:
            rake = int(rake)

        if slip is not None:
            slip = float(slip)
            length = float(length)
            width = float(width)

        worker = list(
            self._db["settings"].find({
                "type": "worker",
                "algorithm": algo
            })
        )

        available = len(worker)

        if available < 1:
            return jsfail(
                error="No worker for the requested algorithm available"
            )

        selected = worker[random.randint(0, available - 1)]

        return self.start_worker(
            selected, user, name, lat, lon, depth, dip, strike, rake, dur, mag,
            slip, length, width, dateconv, gridres, algo, pois
        )

    # this method is called by the tomcat-server if the computation
    # of an earthquake event is completed - just a workaround until
    # we have everything merged into this python module
    @cherrypy.expose
    def post_compute(self, evtid):
        evt = self._db["eqs"].find_one({"_id": evtid})
        link_id = None
        # create shared link and image only if a computation was performed
        if "process" in evt:
            # create shared link first
            link_id = self._make_shared_link(
                evt["_id"],
                evt["prop"]["longitude"],
                evt["prop"]["latitude"],
                5,
                None
            )
            # create image
            self.make_image(link_id)
            # append everything to the earthquake event
            self._db["eqs"].update(
                {"_id": evtid},
                {"$set": {"shared_link": link_id}}
            )
        if "evtset" not in evt:
            # notify users only if this an official GEOFON event
            inst = self._db["institutions"].find_one({"_id": evt["user"]})
            if inst is not None and (
                    inst["name"] == "gfz" or inst["name"] == "tdss15"
            ):
                self._notify_users(evtid, link_id)
        return jssuccess()

    def _notify_users(self, evtid, link_id=None):
        template = self._db["settings"].find_one({"type": "notify_template"})
        evt = self._db["eqs"].find_one({"_id": evtid})
        cursor = self._db["eqs"].find({
            "id": evt["id"]
        }).sort("refineId", -1).skip(1).limit(1)
        old_evt = None
        if cursor.count(with_limit_and_skip=True) > 0:
            # refinement
            old_evt = cursor[0]
            # mag_diff = abs( evt["prop"]["magnitude"] - \
            #     old_evt["prop"]["magnitude"] )
            now_has_mt = old_evt["prop"]["dip"] is None and \
                evt["prop"]["dip"] is not None
            now_has_sim = "process" not in old_evt and "process" in evt
        # walk through all users and notify them if conditions are met
        for user in self._db["users"].find({
                "$or": [
                    {"inst": evt["user"]},
                    {"provider": evt["user"]}
                ],
                "notify": {"$ne": None},
                "permissions.notify": True
        }):
            kind = None
            if user["notify"].get("offshore") and \
                    evt["prop"]["sea_area"] is None:
                continue
            if user["notify"].get("onMag") is not None and \
                    evt["prop"]["magnitude"] >= user["notify"]["onMag"]:
                if old_evt is not None:
                    # refinement - check update parameter
                    if user["notify"].get("onSim") and now_has_sim:
                        kind = "SIM-NOC"
                    elif user["notify"].get("onMT") and now_has_mt:
                        kind = "MT-NOC"
                    # elif user["notify"].get("onMagChange") is not None and \
                    #         mag_diff > user["notify"]["onMagChange"]:
                    #     kind = "M-NOC"
                else:
                    # new event - check initial conditions
                    kind = "NMSG"
            if kind is not None:
                location = "OFF SHORE" \
                    if evt["prop"]["sea_area"] is not None else "INLAND"
                if user["notify"].get("sms"):
                    twisid = user["properties"].get("TwilioSID", "")
                    twitoken = user["properties"].get("TwilioToken", "")
                    twifrom = user["properties"].get("TwilioFrom", "")
                    sendto = user["notify"]["sms"]
                    text = template["sms_text"] % (
                        kind,
                        evt["prop"]["region"],
                        evt["prop"]["magnitude"],
                        location,
                        evt["id"]
                    )
                    ret = sendtwilliosms(
                        twisid,
                        twitoken,
                        twifrom,
                        sendto,
                        text
                    )
                    print(
                        "SMS-Notification: " + user["username"] +
                        ", " + sendto + ", " + str(ret[0])
                    )
                if user["notify"].get("mail"):
                    sendto = user["notify"]["mail"]
                    subject = "[TC] %s: %.1f, %uKM, %s, %s, %s" % (
                        kind, evt["prop"]["magnitude"], evt["prop"]["depth"],
                        location, evt["id"], evt["prop"]["region"]
                    )
                    text = template["mail_text"] % (
                        evt["prop"]["region"],
                        evt["prop"]["magnitude"],
                        location
                    )
                    if "process" in evt:
                        text += template["mail_text_sim"] % link_id
                    if user["notify"].get("includeMsg"):
                        text += template["mail_text_msg"] % \
                            self._get_msg_texts(evtid, "info")["mail"]
                    ret = sendmail(
                        "GeoPeril",
                        sendto,
                        subject,
                        text
                    )
                    print(
                        "Mail-Notification: " + user["username"] +
                        ", " + sendto + ", " + str(ret[0])
                    )

    # can be used to download the image
    @cherrypy.expose
    def get_image(self, evtid):
        evt = self._db["eqs"].find_one({"_id": evtid})
        if evt is not None:
            cont = 'attachment; filename="%s.png"' % evt["_id"]
            cherrypy.response.headers["Content-Type"] = \
                "application/x-download"
            cherrypy.response.headers["Content-Disposition"] = cont
            return evt["image"]
        return jsfail()

    # retrieve a UTC timestamp from a given datetime object in UTC
    def _get_utc_timestamp(self, utc_date):
        return (utc_date - datetime(1970, 1, 1)) / timedelta(seconds=1)

    # retrieve a UCT datetime object from a given UTC timestamp
    def _get_utc_date(self, utc_timestamp):
        sec_ms = str(utc_timestamp).split('.')
        sec = int(sec_ms[0])
        mic = int(sec_ms[1].ljust(6, '0')) if len(sec_ms) > 1 else 0
        return datetime.utcfromtimestamp(sec).replace(microsecond=mic)

    def _get_events(
        self, user=None, inst=None, etime=None, limit=200, sortby="prop.date"
    ):
        query = []

        if etime is None:
            time = self._get_utc_date(0)
        else:
            time = datetime.strptime(etime, self.DATE_PATTERN)

        if user is not None:
            # TODO: check return values of database query
            userid = self._db["users"].find_one({"username": user})["_id"]
            query.append({"user": userid})

        if inst is not None:
            # TODO: check return values of database query
            instid = self._db["institutions"].find_one({"name": inst})["_id"]
            query.append({"user": instid})

        if len(query) == 0:
            # nothing to query
            return {
                "events": [],
                "maxtime": None
            }

        events = list(
            self._db["eqs"].find(
                {
                    "$or": query,
                    "depr": None,
                    "timestamp": {"$gt": time}
                },
                {
                    "image": False
                }
            ).sort(sortby, pymongo.DESCENDING).limit(int(limit))
        )

        if events != []:
            maxtime = max(events, key=lambda x: x["timestamp"])["timestamp"]
            return {
                "events": events,
                "maxtime": maxtime.strftime(self.DATE_PATTERN)
            }

        return {
            "events": events,
            "maxtime": None
        }

    @cherrypy.expose
    def get_geofon_events(self, time=None, limit=200, apikey=None):
        if self.auth_api(apikey, "inst") is not None:
            rslt = self._get_events(None, "gfz", time, limit)
            return jssuccess(**rslt)
        return jsdeny()

    @cherrypy.expose
    def get_events(self, inst=None, limit=200):
        user = self.getUser()

        if user is None:
            return jsdeny()

        if inst is None and 'inst' in user and user["inst"] is not None:
            inst = self._db["institutions"].find_one({
                "_id": user["inst"]
            }).get("name")

        getevents = self._get_events(None, inst)
        events = getevents.get("events")
        maxtimeevents = getevents.get("maxtime")

        getuserevents = self._get_events(
            user.get("username"), sortby="timestamp"
        )
        userevents = getuserevents.get("events")
        maxtimeuser = getuserevents.get("maxtime")

        if events != [] and userevents != []:
            maxts_events = datetime.strptime(
                maxtimeevents,
                self.DATE_PATTERN
            )

            maxts_user = datetime.strptime(
                maxtimeuser,
                self.DATE_PATTERN
            )

            return jssuccess(
                events=events,
                userevents=userevents,
                maxtime=max(
                    maxts_events, maxts_user
                ).strftime(self.DATE_PATTERN)
            )
        elif events != []:
            return jssuccess(
                events=events,
                userevents=[],
                maxtime=maxtimeevents
            )
        elif userevents != []:
            return jssuccess(
                events=[],
                userevents=userevents,
                maxtime=maxtimeuser
            )

        return jssuccess(
            events=[],
            userevents=[],
            maxtime=None
        )

    @cherrypy.expose
    def gethazardevents(self, **parameters):
        return self.get_hazard_event(**parameters)

    @cherrypy.expose
    def save_picking(self, evtid, station, data):
        user = self.getUser()
        if user is not None:
            self._db["pickings"].update(
                {
                    "userid": user["_id"],
                    "evtid": evtid,
                    "station": station
                },
                {
                    "$set": {
                        "data": json.loads(data),
                        "modified": datetime.utcnow()
                    }
                },
                upsert=True
            )
            return jssuccess()
        return jsdeny()

    @cherrypy.expose
    def load_picking(self, evtid, station):
        user = self.getUser()
        if user is not None:
            obj = self._db["pickings"].find_one(
                {"userid": user["_id"], "evtid": evtid, "station": station}
            )
            if obj is not None:
                return jssuccess(data=obj["data"])
            return jsfail()
        return jsdeny()

    @cherrypy.expose
    def changepassword(self, curpwd, newpwd):
        user = self.getUser()

        if user is None:
            return jsdeny()

        # TODO: we should find a uniform way of password handling
        if user["password"] != b64encode(
                hashlib.new(
                    "sha256",
                    bytes(curpwd, "utf-8")
                ).digest()
        ).decode("ascii"):
            return jsfail(error="The current password does not match.")

        if newpwd == "":
            return jsfail(error="The new password is empty.")

        newpwhash = b64encode(
            hashlib.new(
                "sha256",
                bytes(newpwd, "utf-8")
            ).digest()
        ).decode("ascii")

        # also update salt and hash for signin
        pwsalt, pwhash = createsaltpwhash(newpwd)
        self._db["users"].update(
            {"username": user["username"]},
            {"$set": {
                "password": newpwhash,
                "pwsalt": pwsalt,
                "pwhash": pwhash
            }}
        )

        return jssuccess(user=self._get_user_obj(user))

    @cherrypy.expose
    def saveuserstations(self, stations=None):
        user = self.getUser()

        if user is None:
            return jsdeny()

        if stations is None:
            user["countries"] = []
        elif isinstance(stations, list):
            user["countries"] = stations
        else:
            user["countries"] = [stations]

        user.pop("_id", None)
        self._db["users"].update(
            {"username": user["username"]},
            {"$set": user}
        )

        return jssuccess(user=self._get_user_obj(user))

    @cherrypy.expose
    def saveusersettings(self, props, inst, notify, api, stations=None):
        user = self.getUser()
        if user is None:
            return jsdeny()

        try:
            # inititalize sub object if not present
            user["properties"] = user.get("properties", {})
            # update object with given attributes
            user["properties"].update(json.loads(props))
            # analogous for notifications
            user["notify"] = user.get("notify", {})
            user["notify"].update(json.loads(notify))
            inst = json.loads(inst)
            api = json.loads(api)
            # override stations
            if stations is not None:
                user["countries"] = json.loads(stations)
        except ValueError:
            return jsfail(error="Invalid JSON input.")

        permissions = user.get("permissions")

        if (
            permissions is not None and permissions.get("manage", False)
            and bool(inst)
        ):
            # load JSON input and remove attributes that are not allowed
            # to change
            inst.pop("_id", None)
            inst.pop("name", None)
            # TODO: search for inst object in db and set objectid reference
            self._db["institutions"].update(
                {"_id": user["inst"]},
                {"$set": inst}
            )

        # make sure that given API-key is valid
        if (
            permissions is not None
            and permissions.get("api", False)
            and bool(api)
            and api["key"] != ""
        ):
            if re.compile("^[0-9a-f]{32}$").match(api["key"]) is None:
                return jsfail(error="Invalid API-key given.")
            if self._db["users"].find_one({
                    "api.key": api["key"],
                    "username": {"$ne": user["username"]}
            }) is not None:
                return jsfail(error="Invalid API-key given.")
            if self._db["institutions"].find_one({
                    "api.key": api["key"]
            }) is not None:
                return jsfail(error="Invalid API-key given.")
            user["api"] = api

        # update user entry - we need to remove the "_id" attribute to
        # make pymongo happy
        user.pop("_id", None)
        self._db["users"].update(
            {"username": user["username"]},
            {"$set": user}
        )
        return jssuccess(user=self._get_user_obj(user))

    # this method collects all the user data that should be delivered to
    # the client - sensible information need to be removed
    def _get_user_obj(self, user):
        user["inst"] = self._db["institutions"].find_one({"_id": user["inst"]})

        if (user.get("inst")):
            user["inst"].pop("_id", None)
            user["inst"].pop("secret", None)
            user["inst"].pop("apikey", None)

        # TODO: better include wanted fields explicitly instead of removing
        # irrelevant ones
        user.pop("_id", None)
        user.pop("password", None)
        user.pop("pwhash", None)
        user.pop("pwsalt", None)
        user.pop("session", None)
        return user

    # generates a random key of 32 hexadecimal characters
    @cherrypy.expose
    def generate_apikey(self):
        return jssuccess(key=binascii.b2a_hex(os.urandom(16)).decode("ascii"))

    @cherrypy.expose
    def generate_report(self, evtid):
        msg = self._get_msg_texts(evtid, "info")["mail"]
        url = self.get_hostname() + \
            "/datasrv/%s/wavejets_traveltimes_web.png?server_cookie=%s" % \
            (evtid, cherrypy.request.cookie["server_cookie"].value)
        sec = '''
                <br>
                <img style="width: 600px;" src="%s"></img>
        ''' % (url)
        lnk = self._db["shared_links"].find_one({
            "evtid": evtid, "userid": None
        })
        if lnk is not None:
            sec += '''
                <br><br>
                <a href="%s">Visit shared map</a>
            ''' % (self.get_hostname() + "/?share=" + str(lnk["_id"]))
        txt = '''
        <html>
            <body>
                <pre style="font-family: monospace; white-space: ''' + \
            '''
            pre-wrap; word-wrap: break-word; font-size: 0.8em;">%s</pre>
                %s
            </body>
        </html>''' % (msg, sec)
        cherrypy.response.headers['Content-Type'] = "application/pdf"
        cherrypy.response.headers['Content-Disposition'] = \
            'attachment; filename="report_%s.pdf"' % evtid
        return self.html2pdf(txt)

    @cherrypy.expose
    def delete_event(self, inst, secret, evtid):
        inst = self._db["institutions"].find_one({
            "name": inst, "secret": secret
        })
        if inst is not None:
            if self._db["eqs"].find_one({
                    "user": inst["_id"], "_id": evtid
            }) is not None:
                self._db["comp"].remove({"EventID": evtid})
                self._db["simsealeveldata"].remove({"evid": evtid})
                self._db["eqs"].remove({"_id": evtid})
                self._db["events"].remove({"id": evtid})
                self._db["shared_links"].remove({"evtid": evtid})
                return jssuccess()
            return jsfail()
        return jsdeny()

    @cherrypy.expose
    def get_stats(self, time):
        aggr = [
            # include all records since given time
            {
                "$match": {
                    "date": {"$gte": self._get_utc_date(time)}
                }
            },
            # group records of same day and same user together; add count
            {
                "$group": {
                    "_id": {
                        "year": {"$year": "$date"},
                        "month": {"$month": "$date"},
                        "day": {"$dayOfMonth": "$date"},
                        "user": "$user"
                    },
                    "count": {"$sum": 1}
                }
            },
            # second group: now combine the list of days per user
            {
                "$group": {
                    "_id": "$_id.user",
                    "logins": {
                        "$push": {
                            "year": "$_id.year",
                            "month": "$_id.month",
                            "day": "$_id.day",
                            "count": "$count"
                        }
                    }
                }
            },
            # rename and hide some fields
            {
                "$project": {
                    "user": "$_id",
                    "_id": 0,
                    "logins": 1
                }
            }
        ]
        res = self._db["logins"].aggregate(aggr)
        return jssuccess(users=list(res))

    def getInst(self, dbUser):
        instId = dbUser["inst"]
        instObj = self._db["institutions"].find_one({
            "_id": instId
        })

        if instObj is None:
            return None

        return instObj

    @cherrypy.expose
    @cherrypy.tools.allow(methods=['POST'])
    def data_insert(
        self, **params
    ):
        inst = params.get("inst")
        secret = params.get("secret")
        evid = params.get("id")
        name = params.get("name")
        lon = params.get("lon")
        lat = params.get("lat")
        mag = params.get("mag")
        slip = params.get("slip")
        length = params.get("length")
        width = params.get("width")
        depth = params.get("depth")
        dip = params.get("dip")
        strike = params.get("strike")
        rake = params.get("rake")
        date = params.get("date")
        sea_area = params.get("sea_area")
        root = params.get("root")
        parent = params.get("parent")
        comp = params.get("comp")
        gridres = params.get("gridres")
        apikey = params.get("apikey")
        algo = params.get("algo", "easywave")
        bb_url = params.get("bb_url")

        if lat is not None:
            lat = float(lat)

        if lon is not None:
            lon = float(lon)

        if depth is not None:
            depth = float(depth)

        if mag is not None:
            mag = float(mag)

        if slip is not None:
            slip = float(slip)

        if length is not None:
            length = float(length)

        if width is not None:
            width = float(width)

        if dip is not None:
            dip = int(dip)

        if strike is not None:
            strike = int(strike)

        if rake is not None:
            rake = int(rake)

        if gridres is not None:
            gridres = int(gridres)

        useApiKey = apikey
        useRoot = root

        # Check for invalid parameter configurations.
        if (inst is not None or secret is not None) and useApiKey is not None:
            return jsfail(error="Don't mix 'apikey' and 'secret'.")

        if (
            mag is not None
            and (slip is not None or length is not None or width is not None)
        ):
            return jsfail(
                error="Don't mix 'mag' with 'slip', 'length' and 'width'."
            )

        # Support 'inst' and 'secret' for compatibility reasons.
        if inst is not None and secret is not None:
            # Obtain the 'apikey' and pretend a call to the new api.
            tmpInst = self._db["institutions"].find_one({
                "name": inst,
                "secret": secret
            })

            if tmpInst is None:
                return jsdeny()

            if "api" not in tmpInst and "key" not in tmpInst["api"]:
                return jsfail(error="No 'apikey' set for this institution!")

            useApiKey = tmpInst["api"]["key"]

        # Continue with the new API.
        if useApiKey is None or id is None or name is None or date is None:
            return jsfail(error="required parameters are missing")

        dbUser = self.auth_api(useApiKey, "user")
        dbInst = self.auth_api(useApiKey, "inst")

        # check if we got a valid institution and the correct secret
        userId = None
        username = None
        user = None

        if dbUser is not None:
            userId = dbUser["_id"]
            username = dbUser["username"]
            user = dbUser
        elif dbInst is not None:
            userId = dbInst["_id"]
            username = dbInst["name"]
            user = {
                "username": username,
                "inst": dbInst.get("_id")
            }
        else:
            return jsdeny(error="Not allowed to use API")

        # get Date object from date string
        date_time = datetime.strptime(date, self.DATE_PATTERN)

        if date_time is None:
            return jsfail(error="Invalid date format")

        # get current timestamp
        timestamp = datetime.now()

        # create new sub object that stores the properties
        sub = {
            "date": date_time,
            "region": name,
            "latitude": lat,
            "longitude": lon,
            "magnitude": mag,
            "slip": slip,
            "length": length,
            "width": width,
            "depth": depth,
            "dip": dip,
            "strike": strike,
            "rake": rake,
            "sea_area": sea_area,
            "bb_url": bb_url,
            "comp": comp,
            "gridres": gridres,
            "algo": algo
        }

        # create new DB object that should be added to the eqs collection
        obj = {
            "id": evid,
            "user": userId,
            "timestamp": timestamp,
            "prop": sub,
            "root": useRoot,
            "parent": parent
        }

        # create a new event
        event = {
            "user": userId,
            "timestamp": timestamp,
            "event": "new"
        }

        refineId = 0

        # get earthquake collection
        coll = self._db["eqs"]

        # search for given id
        found = coll.find(
            {
                "id": evid,
                "user": userId
            },
            sort=[('refineId', pymongo.DESCENDING)]
        )

        entry = None

        # if id is already used, make a refinement
        for cursor in found:
            entry = cursor
            coll.update(entry, {
                "$set": {
                    "depr": True
                }
            })

            refineId = entry["refineId"]

            if refineId is None:
                refineId = 0

            refineId += 1

            # override parent and root attributes
            if entry.get("root") is None:
                useRoot = entry["_id"]
            else:
                useRoot = entry["root"]

            entry["root"] = useRoot
            entry["parent"] = entry["_id"]

            # override event type
            entry["event"] = "update"

            break

        # set refinement and compound Ids
        compId = evid + "_" + username + "_" + str(refineId)
        obj["_id"] = compId
        obj["refineId"] = refineId
        event["id"] = compId

        # insert object into 'eqs' collection
        coll.insert_one(obj)

        if comp is not None and (
            (
                evid is not None and lon is not None and lat is not None
                and mag is not None and depth is not None and dip is not None
                and strike is not None and rake is not None
            ) or (
                evid is not None and lon is not None and lat is not None
                and slip is not None and length is not None
                and width is not None and depth is not None and dip is not None
                and strike is not None and rake is not None
            )
        ):
            worker = list(
                self._db["settings"].find({
                    "type": "worker",
                    "algorithm": algo
                })
            )

            available = len(worker)

            if available < 1:
                return jsfail(
                    error="No worker for the requested algorithm available"
                )

            # TODO: better scheduling
            # -> memorize last used slot for this algo in DB
            selected = worker[random.randint(0, available - 1)]

            # TODO: really needed?
            self._db["events"].insert_one(event)

            return self.start_worker(
                selected, user, name, lat, lon, depth, dip, strike, rake, comp,
                mag, slip, length, width, date_time, gridres, algo, None,
                compId
            )

        # TODO: really needed?
        self._db["events"].insert_one(event)

        return jssuccess(refineid=refineId, evtid=compId)

    @cherrypy.expose
    @cherrypy.tools.allow(methods=['POST'])
    def update(
        self, **params
    ):
        ts = params.get("ts")

        if ts is None:
            return jsfail(error="Missing request parameter")

        user = self.getUser()

        if user is None or user.get("username") is None:
            return jsdeny()

        inst = None

        if inst is None and 'inst' in user and user["inst"] is not None:
            inst = self._db["institutions"].find_one({
                "_id": user["inst"]
            }).get("name")

        userevents = self._get_events(user.get("username"), None, ts, 200)
        instevents = self._get_events(None, inst, ts, 200)

        maxtime = None
        maxtimeuser = userevents.get("maxtime")
        maxtimeinst = instevents.get("maxtime")

        if maxtimeuser is None:
            maxtime = maxtimeinst
        elif maxtimeinst is None:
            maxtime = maxtimeuser
        else:
            maxtime = max(
                datetime.strptime(maxtimeuser, self.DATE_PATTERN),
                datetime.strptime(maxtimeinst, self.DATE_PATTERN),
            ).strftime(self.DATE_PATTERN)

        return jssuccess(
            events=instevents.get("events"),
            userevents=userevents.get("events"),
            maxtime=maxtime
        )


class WatchExecution(threading.Thread):
    db: Database = None
    execution: wps.WPSExecution = None
    eqsId: str = None
    inst: str = None
    username: str = None
    worker: dict = None
    resultsdir: str = None
    zeroDisplacementMsg: str = "Zero initial displacement"

    def __init__(
        self,
        db: Database,
        execution: wps.WPSExecution,
        eqsId: str,
        resultsdir: str,
        inst: str,
        username: str,
        workerObj: dict
    ):
        threading.Thread.__init__(self)
        self.db = db
        self.execution = execution
        self.eqsId = eqsId
        self.resultsdir = resultsdir
        self.inst = inst
        self.username = username
        self.worker = workerObj

    def updateProgress(self, progress: int):
        self.db["eqs"].update(
            {"_id": self.eqsId},
            {
                "$set": {
                    "progress": progress,
                    "timestamp": datetime.now()
                }
            }
        )

    def run(self):
        eqsdb = self.db["eqs"]
        eqs = eqsdb.find_one({"_id": self.eqsId})

        if eqs is None:
            raise Exception("Internal error: expected eqs entry in DB")

        # set initial progress to notify frontend
        self.updateProgress(0)

        while self.execution.isComplete() is False:
            oldpercent = self.execution.percentCompleted
            self.execution.checkStatus(sleepSecs=1)
            newpercent = self.execution.percentCompleted

            if oldpercent != newpercent:
                if newpercent == 100:
                    # we still need to save the results
                    self.updateProgress(99)
                else:
                    self.updateProgress(newpercent)

        if not self.execution.isSucceded():
            status = -1

            for ex in self.execution.errors:
                if bool(re.match(r'.*' + self.zeroDisplacementMsg, ex.text)):
                    status = -2
                else:
                    logger.error(
                        'Error: code=%s, locator=%s, text=%s' %
                        (ex.code, ex.locator, ex.text)
                    )

            self.updateProgress(status)
            return

        try:
            # /geoperil/results/inst/user/algo/processid
            resultspath = os.path.join(
                self.resultsdir,
                self.inst,
                self.username,
                self.worker.get("algorithm", "None"),
                self.eqsId
            )

            arrivalRef = None
            arrivalRawRef = None
            waveheightsRef = None
            waveheightsRawRef = None
            poisWaveheightsRef = None

            for output in self.execution.processOutputs:
                ident = output.identifier

                if ident == 'calctime':
                    calctime = output.data[0]
                elif ident == 'arrivaltimes':
                    arrivalRef = output.reference
                elif ident == 'arrivaltimesRaw':
                    arrivalRawRef = output.reference
                elif ident == 'waveheights':
                    waveheightsRef = output.reference
                elif ident == 'waveheightsRaw':
                    waveheightsRawRef = output.reference
                elif ident == 'poisWaveheights':
                    poisWaveheightsRef = output.reference

            if (
                calctime is None
                or arrivalRawRef is None or waveheightsRawRef is None
            ):
                logger.error('Unexpected output from WPS')
                self.updateProgress(-1)
                return

            if not os.path.exists(resultspath):
                os.makedirs(resultspath)

            arrivalFile = os.path.join(resultspath, ARRIVALTIMES_DEFAULT_FILE)
            arrivalRawFile = os.path.join(resultspath, ARRIVALTIMES_RAW_FILE)
            waveheightsFile = os.path.join(
                resultspath, WAVEHEIGHTS_DEFAULT_FILE
            )
            waveheightsRawFile = os.path.join(
                resultspath, WAVEHEIGHTS_RAW_FILE
            )
            poisWaveheightsFile = os.path.join(
                resultspath, POISWAVEHEIGHTS_FILE
            )

            urlretrieve(arrivalRawRef, arrivalRawFile)
            urlretrieve(waveheightsRawRef, waveheightsRawFile)

            if arrivalRef:
                urlretrieve(arrivalRef, arrivalFile)

            if waveheightsRef:
                urlretrieve(waveheightsRef, waveheightsFile)

            if poisWaveheightsRef:
                urlretrieve(poisWaveheightsRef, poisWaveheightsFile)

        except Exception as ex:
            logger.error(traceback.format_exc())
            self.updateProgress(-1)
            return

        # add outputs to DB
        eqsdb.update(
            {
                "_id": self.eqsId
            }, {
                "$set": {
                    "calctime": int(calctime),
                    "resultsdir": resultspath,
                    "progress": 100
                }
            }
        )


application = startapp(WebGuiSrv)
