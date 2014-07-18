from base import *

logger = logging.getLogger("MsgSrv")

class FeederSrv(Base):

    @cherrypy.expose
    def index(self):
        return "Hello World!" + str(self.getUser())

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
                data["timestamp"] = timestamp
                data["value"] = value
                data["station"] = station
                data["inst"] = inst["name"]
                self._db["sealeveldata"].insert(data)
                return jssuccess()
            return jsfail(errors = ["There is no stations named %s." % station])
        return jsdeny()

    def feedsealevel_api2(self, inst, secret, json=None, xml=None, text=None):
        inst = self._db["institutions"].find_one({"name":inst, "secret": secret})
        if inst is not None:
            if json is not None:
                return self.feedsealevel_api2_json(inst, json)
            elif xml is not None:
                return self.feedsealevel_api2_xml(inst, xml)
            elif text is not None:
                return self.feedsealevel_api2_text(inst, text)
            return jsfail(errors = ["One of the following Parameters is mandatory: json, xml, text"])
        return jsdeny()
        
    def feedsealevel_api2_json(self, inst, json):
        
        pass

    def feedsealevel_api2_xml(self, inst, xml):
        pass

    def feedsealevel_api2_text(self, inst, text):
        pass

application = startapp( FeederSrv )
