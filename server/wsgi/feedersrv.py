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

from basesrv import *
import time
jsonlib = json

logger = logging.getLogger("FeederSrv")

class FeederSrv(BaseSrv):

    @cherrypy.expose
    def feed(self, cls="auto", **data):
        if "inst" in data and "secret" in data and \
          self._db["institutions"].find_one({"name":data["inst"], "secret": data["secret"]}) is not None:
            if cls == "auto":
                cls = self.guessclass(data)
            if cls is None:
                return jsfail(errors = ["Auto recognizing data failed."])
            elif cls == "station":
                return self.feedstation(**data)
            elif cls == "sealeveldata":
                return self.feedsealevel(**data)
            else:
                return jsfail(errors = ["Unknown class %s." % cls])
        return jsdeny()

    def guessclass(self, data):
        if checkargs(data,"timestamp","value","station",apiver="1"):
            return "sealeveldata"
        elif checkargs(data,["json","xml","text"],apiver="2"):
            return "sealeveldata"
        elif checkargs(data,"station","apiver"):
            return "station"
        return None

    @cherrypy.expose
    def feedstation(self, apiver, inst, secret, station):
        if apiver == "1":
            inst = self._db["institutions"].find_one({"name":inst, "secret": secret})
            if inst is not None and inst.get("feedstations",False):
                station = json.loads(station)
                if station is not None and "name" in station:
                    station["inst"] = inst["name"]
                    station["lastmetadataupdate"] = int(time.time())
                    res = self._db["stations"].update({"inst":inst["name"], "name":station["name"]},{"$set":station})
                    if not res["updatedExisting"]:
                        self._db["stations"].insert(station)
                    station = self._db["stations"].find_one({"inst":inst["name"], "name":station["name"]})
                    return jssuccess(station = station)
                return jsfail(errors = ["The station needs a name."])
            return jsdeny()
        return jsfail(errors = ["API version not supported."])

    @cherrypy.expose
    def feedsealevel(self, apiver, **data):
        if apiver == "1":
            params = ["inst", "secret", "timestamp","value","station"]
            if set(params).issubset(set(data.keys())):
                return self.feedsealevel_api1(**data)
            return jsfail(errors = ["The following Parameters are mandatory: %s" % (", ".join(params))])
        elif apiver == "2":
            if set( ["inst", "secret"] ).issubset(set(data.keys())):
                return self.feedsealevel_api2(**data)
            return jsfail(errors = ["The following Parameters are mandatory: inst, secret"])
        return jsfail(errors = ["API version not supported."])

    @cherrypy.expose
    def feedhazardevent(self, apiver, inst, secret, event):
        if apiver == "1":
            inst = self._db["institutions"].find_one({"name":inst, "secret": secret})
            if inst is not None:
                return self.feed_hazard_event(jsonlib.loads(event))
            return jsdeny()
        return jsfail(errors = ["API version not supported."])

    def feedsealevel_api1(self, inst, secret, timestamp, value, station, **data):
        inst = self._db["institutions"].find_one({"name":inst, "secret": secret})
        if inst is not None:
            s = self._db["stations"].find_one({"inst":inst["name"], "name":station})
            if s is not None:
                data["timestamp"] = int(timestamp)
                data["value"] = value
                data["station"] = station
                data["inst"] = inst["name"]
                update = {
                    "inst":inst["name"], 
                    "station":station, 
                    "timestamp":int(timestamp),
                    }
                if "evid" in data:
                    data["_id"] = "{evid}_{station}_{timestamp!s}".format_map(data)
                    self._db["simsealeveldata"].save(data)
                else:
                    data["_id"] = "{inst}_{station}_{timestamp!s}".format_map(data)
                    self._db["sealeveldata"].save(data)
                return jssuccess()
            return jsfail(errors = ["There is no stations named %s." % station])
        return jsdeny()

    def feedsealevel_api2(self, inst, secret, json=None, xml=None, text=None, **data):
        inst = self._db["institutions"].find_one({"name":inst, "secret": secret})
        if inst is not None:
            if json is not None:
                self.feedsealevel_api2_json_new(inst, json, **data)
                return self.feedsealevel_api2_json(inst, json, **data)
            elif xml is not None:
                return self.feedsealevel_api2_xml(inst, xml, **data)
            elif text is not None:
                return self.feedsealevel_api2_text(inst, text, **data)
            return jsfail(errors = ["One of the following Parameters is mandatory: json, xml, text"])
        return jsdeny()
        
    def feedsealevel_api2_json(self, inst, json, dataformat="simple", station=None):
        if dataformat == "simple":
            if station is not None:
                json = jsonlib.loads(json)
                vnr = 0
                verr = 0
                ids = []
                values = []
                for v in json:
                    if "value" in v and "timestamp" in v:
                        v["value"] = str(v["value"])
                        v["timestamp"] = int(v["timestamp"])
                        v["inst"] = inst["name"]
                        v["station"] = station
                        v["_id"] = "{inst}_{station}_{timestamp!s}".format_map(v)
                        self._db["sealeveldata"].remove(v["_id"])
                        if v["_id"] not in ids:
                            values.append(v)
                            ids.append(v["_id"])
                        vnr += 1
                    else:
                        verr += 1
                if len(values)>0:
                    self._db["sealeveldata"].insert(values)
                last = self._db["sealeveldata"].find_one({"inst":inst["name"],"station":station},sort=[("timestamp",-1)])
                lastts = None if last is None else last["timestamp"]
                return jssuccess(values = vnr, errors = verr, lastts = lastts)
            else:
                return jsfail(errors = ["Parameter station is missing."])
        return jsfail(errors = ["Dataformat %s not known." % dataformat])

    def feedsealevel_api2_json_new(self, inst, json, dataformat="simple", station=None):
        if dataformat == "simple":
            if station is not None:
                json = jsonlib.loads(json)
                vnr = 0
                verr = 0
                ids = []
                values = {}
                for v in json:
                    if "value" in v and "timestamp" in v:
                        value = str(v["value"])
                        ts = int(v["timestamp"])
                        daystart = (ts // (60*60*24)) * 60*60*24
                        dayts = ts % (60*60*24)
                        if daystart not in values:
                            values[daystart] = {}
                        values[daystart][dayts] = value
                        vnr += 1
                    else:
                        verr += 1
                if len(values)>0:
                    for daystart,vals in values.items():
                        vs = {}
                        for k,v in vals.items():
                            vs["data.%d" % k] = v
                        q = {"inst":inst["name"],"station":station,"daystart":daystart}
                        # Workaround for Mongo 2.4
                        old = self._db["sealeveldata_new"].find_one(q)
                        if old is None:
                            vs["last_ts"] = daystart + max(vals.keys())
                            vs["first_ts"] = daystart + min(vals.keys())
                        else:
                            vs["last_ts"] = daystart + max(max(vals.keys()), max([ int(x) for x in old["data"].keys() ]))
                            vs["first_ts"] = daystart + min(min(vals.keys()), min([ int(x) for x in old["data"].keys() ]))
                        # End of Workaround
                        self._db["sealeveldata_new"].update(q, {
                            "$set":vs,
#                            "$max":{"last_ts": daystart + max(vals.keys()) },
#                            "$min":{"first_ts": daystart + min(vals.keys()) },
                            "$setOnInsert":q
                        }, upsert = True)
                last = self._db["sealeveldata_new"].find_one({"inst":inst["name"],"station":station},sort=[("last_ts",-1)])
                lastts = None if last is None else last["last_ts"]
                return jssuccess(values = vnr, errors = verr, lastts = lastts)
            else:
                return jsfail(errors = ["Parameter station is missing."])
        return jsfail(errors = ["Dataformat %s not known." % dataformat])

    def feedsealevel_api2_xml(self, inst, xml):
        return jsfail(errors = ["Not yet implemented."])

    def feedsealevel_api2_text(self, inst, text):
        return jsfail(errors = ["Not yet implemented."])

application = startapp( FeederSrv )
