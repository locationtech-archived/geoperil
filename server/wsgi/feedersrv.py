from base import *
jsonlib = json

logger = logging.getLogger("MsgSrv")

class FeederSrv(Base):

    @cherrypy.expose
    def index(self):
        return "Hello World!" + str(self.getUser())

    @cherrypy.expose
    def feedstation(self, apiver, inst, secret, station):
        if apiver == "1":
            inst = self._db["institutions"].find_one({"name":inst, "secret": secret})
            if inst is not None and inst.get("feedstations",False):
                station = json.loads(station)
                if station is not None and "name" in station:
                    s = self._db["stations"].find_one({"inst":inst["name"], "name":station["name"]})
                    station["inst"] = inst["name"]
                    if s is None:
                        self._db["stations"].insert(station)
                    else:
                        print(self._db["stations"].update({"inst":inst["name"], "name":station["name"]},{"$set":station}))
                    return jssuccess()
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

    def feedsealevel_api1(self, inst, secret, timestamp, value, station, **data):
        inst = self._db["institutions"].find_one({"name":inst, "secret": secret})
        if inst is not None:
            s = self._db["stations"].find_one({"inst":inst["name"], "name":station})
            if s is not None:
                data["timestamp"] = int(timestamp)
                data["value"] = value
                data["station"] = station
                data["inst"] = inst["name"]
                if "evid" in data:
                    self._db["simsealeveldata"].insert(data)
                else:
                    self._db["sealeveldata"].insert(data)
                return jssuccess()
            return jsfail(errors = ["There is no stations named %s." % station])
        return jsdeny()

    def feedsealevel_api2(self, inst, secret, json=None, xml=None, text=None, **data):
        inst = self._db["institutions"].find_one({"name":inst, "secret": secret})
        if inst is not None:
            if json is not None:
                return self.feedsealevel_api2_json(inst, json, **data)
            elif xml is not None:
                return self.feedsealevel_api2_xml(inst, xml, **data)
            elif text is not None:
                return self.feedsealevel_api2_text(inst, text, **data)
            return jsfail(errors = ["One of the following Parameters is mandatory: json, xml, text"])
        return jsdeny()
        
    def feedsealevel_api2_json(self, inst, json, dataformat="simple", station=None):
        if dataformat == "simple":
            if station is not None
                json = jsonlib.loads(json)
                vnr = 0
                verr = 0
                for v in json:
                    if "value" in v and "timestamp" in v:
                        v["value"] = str(v["value"])
                        v["timestamp"] = int(v["timestamp"])
                        v["inst"] = inst["name"]
                        v["station"] = station
                        self._db["sealeveldata"].insert(v)
                        vnr += 1
                    else:
                        verr += 1
                return jssuccess(values = vnr, errors = verr)
            else:
                return jsfail(errors = ["Parameter station is missing."])
        return jsfail(errors = ["Dataformat %s not known." % dataformat])


    def feedsealevel_api2_xml(self, inst, xml):
        return jsfail(errors = ["Not yet implemented."])

    def feedsealevel_api2_text(self, inst, text):
        return jsfail(errors = ["Not yet implemented."])

application = startapp( FeederSrv )
