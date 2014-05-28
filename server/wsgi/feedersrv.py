from base import *

logger = logging.getLogger("MsgSrv")

class FeederSrv(Base):

    @cherrypy.expose
    def index(self):
        return "Hello World!" + str(self.getUser())

    @cherrypy.expose
    def feedsealevel(self, apiver, **data):
        if apiver == "1":
            params = ["secret", "timestamp","value","station"]
            if set(params).issubset(set(data.keys())):
                return self.feedsealevel_api1(**data)
            else:
                return jsfail(errors = ["The following Parameters are mandatory: %s" % (", ".join(params))])
        elif apiver == "2":
            if "secret" in data.keys():
                return self.feedsealevel_api2(**data)
            else:
                return jsfail(errors = ["The following Parameters are mandatory: secret"])
        else:
            return jsfail(errors = ["API version not supported."])

    def feedsealevel_api1(self, secret, timestamp, value, station, **data):
        inst = self._db["institutions"].find_one({"secret": secret})
        if inst is not None:
            data["timestamp"] = timestamp
            data["value"] = value
            data["station"] = station
            self._db["sealeveldata"].insert(data)
            return jssuccess()
        else:
            return jsdeny()

    def feedsealevel_api2(self, secret, json=None, xml=None, text=None):
        inst = self._db["institutions"].find_one({"secret": secret})
        if inst is not None:
            if json is not None:
                return self.feedsealevel_api2_json(inst, json)
            elif xml is not None:
                return self.feedsealevel_api2_xml(inst, xml)
            elif text is not None:
                return self.feedsealevel_api2_text(inst, text)
            else:
                return jsfail(errors = ["One of the following Parameters is mandatory: json, xml, text"])
        else:
            return jsdeny()
        
    def feedsealevel_api2_json(self, inst, json):
        pass

    def feedsealevel_api2_xml(self, inst, xml):
        pass

    def feedsealevel_api2_text(self, inst, text):
        pass

application = startapp( FeederSrv )
