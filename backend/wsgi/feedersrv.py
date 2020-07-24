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

import logging
import json
import time
import cherrypy
from basesrv import BaseSrv
from base import jsfail, jsdeny, jssuccess, checkargs, startapp

jsonlib = json

logger = logging.getLogger("FeederSrv")


class FeederSrv(BaseSrv):
    @cherrypy.expose
    def feed(self, cls="auto", **data):
        if (
                "inst" in data and "secret" in data and
                self._db["institutions"].find_one({
                    "name": data["inst"],
                    "secret": data["secret"]
                }) is not None
        ):
            if cls == "auto":
                cls = self.guessclass(data)
            if cls is None:
                return jsfail(errors=["Auto recognizing data failed."])
            if cls == "station":
                return self.feedstation(**data)
            if cls == "sealeveldata":
                return self.feedsealevel(**data)
            return jsfail(errors=["Unknown class %s." % cls])
        return jsdeny()

    def guessclass(self, data):
        if checkargs(data, "timestamp", "value", "station", apiver="1"):
            return "sealeveldata"
        if checkargs(data, ["json", "xml", "text"], apiver="2"):
            return "sealeveldata"
        if checkargs(data, "station", "apiver"):
            return "station"
        return None

    @cherrypy.expose
    def feedstation(self, apiver, inst, secret, station):
        if apiver == "1":
            inst = self._db["institutions"].find_one({
                "name": inst,
                "secret": secret
            })
            if inst is not None and inst.get("feedstations", False):
                station = json.loads(station)
                if station is not None and "name" in station:
                    station["inst"] = inst["name"]
                    station["lastmetadataupdate"] = int(time.time())
                    res = self._db["stations"].update(
                        {
                            "inst": inst["name"], "name": station["name"]
                        },
                        {
                            "$set": station
                        }
                    )
                    if not res["updatedExisting"]:
                        self._db["stations"].insert(station)
                    station = self._db["stations"].find_one({
                        "inst": inst["name"],
                        "name": station["name"]
                    })
                    return jssuccess(station=station)
                return jsfail(errors=["The station needs a name."])
            return jsdeny()
        return jsfail(errors=["API version not supported."])

    @cherrypy.expose
    def feedsealevel(self, apiver, **data):
        if apiver == "1":
            params = ["inst", "secret", "timestamp", "value", "station"]
            if set(params).issubset(set(data.keys())):
                return self.feedsealevel_api1(**data)
            return jsfail(
                errors=[
                    "The following Parameters are mandatory: %s" %
                    (", ".join(params))
                ]
            )
        if apiver == "2":
            if set(["inst", "secret"]).issubset(set(data.keys())):
                return self.feedsealevel_api2(**data)
            return jsfail(
                errors=["The following Parameters are mandatory: inst, secret"]
            )
        return jsfail(errors=["API version not supported."])

    @cherrypy.expose
    def feedhazardevent(self, apiver, inst, secret, event):
        if apiver == "1":
            inst = self._db["institutions"].find_one({
                "name": inst,
                "secret": secret
            })
            if inst is not None:
                return self.feed_hazard_event(jsonlib.loads(event))
            return jsdeny()
        return jsfail(errors=["API version not supported."])

    def feedsealevel_api1(
            self, inst, secret, timestamp, value, station, **data
    ):
        inst = self._db["institutions"].find_one({
            "name": inst,
            "secret": secret
        })
        if inst is not None:
            sta = self._db["stations"].find_one({
                "inst": inst["name"],
                "name": station
            })
            if sta is not None:
                data["timestamp"] = int(timestamp)
                data["value"] = value
                data["station"] = station
                data["inst"] = inst["name"]
                # update = {
                #     "inst": inst["name"],
                #     "station": station,
                #     "timestamp": int(timestamp),
                # }
                if "evid" in data:
                    data["_id"] = "{evid}_{station}_{timestamp!s}" \
                        .format_map(data)
                    self._db["simsealeveldata"].save(data)
                else:
                    data["_id"] = "{inst}_{station}_{timestamp!s}" \
                        .format_map(data)
                    self._db["sealeveldata"].save(data)
                return jssuccess()
            return jsfail(errors=["There is no stations named %s." % station])
        return jsdeny()

    def feedsealevel_api2(
            self, inst, secret, json=None, xml=None, text=None, **data
    ):
        inst = self._db["institutions"].find_one({
            "name": inst,
            "secret": secret
        })
        if inst is not None:
            if json is not None:
                return self.feedsealevel_api2_json(inst, json, **data)
            if xml is not None:
                return self.feedsealevel_api2_xml(inst, xml, **data)
            if text is not None:
                return self.feedsealevel_api2_text(inst, text, **data)
            return jsfail(
                errors=[
                    "One of the following Parameters is mandatory: " +
                    "json, xml, text"
                ]
            )
        return jsdeny()

    def feedsealevel_api2_json(
            self, inst, json, dataformat="simple", station=None
    ):
        if dataformat == "simple":
            if station is not None:
                json = jsonlib.loads(json)
                vnr = 0
                verr = 0
                ids = []
                values = []
                for val in json:
                    if "value" in val and "timestamp" in val:
                        val["value"] = str(val["value"])
                        val["timestamp"] = int(val["timestamp"])
                        val["inst"] = inst["name"]
                        val["station"] = station
                        val["_id"] = "{inst}_{station}_{timestamp!s}" \
                            .format_map(val)
                        self._db["sealeveldata"].remove(val["_id"])
                        if val["_id"] not in ids:
                            values.append(val)
                            ids.append(val["_id"])
                        vnr += 1
                    else:
                        verr += 1
                if values != []:
                    self._db["sealeveldata"].insert(values)
                last = self._db["sealeveldata"].find_one(
                    {
                        "inst": inst["name"],
                        "station": station
                    },
                    sort=[("timestamp", -1)]
                )
                lastts = None if last is None else last["timestamp"]
                return jssuccess(values=vnr, errors=verr, lastts=lastts)
            return jsfail(errors=["Parameter station is missing."])
        return jsfail(errors=["Dataformat %s not known." % dataformat])

    def feedsealevel_api2_xml(self, inst, xml):
        return jsfail(errors=["Not yet implemented."])

    def feedsealevel_api2_text(self, inst, text):
        return jsfail(errors=["Not yet implemented."])


application = startapp(FeederSrv)
