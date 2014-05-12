from base import *

logger = logging.getLogger("MsgSrv")

class FeederSrv(Base):

    @cherrypy.expose
    def index(self):
        return "Hello World!" + str(self.getUser())

    @cherrypy.expose
    def feedsealevel(self, apiver, **data):
        if apiver == "1":
            params = ["secret", "timestamp","value","station","latitude","longitude"]
            if set(params).issubset(set(data.keys())):
                return self.feedsealevel_api1(**data)
            else:
                return jsfail(errors = ["The following Parameters are mandatory: %s" % (", ".join(params))])
        else:
            return jsfail(errors = ["API version not supported."])

    def feedsealevel_api1(self, secret, timestamp, value, station, latitude, longitude, **data):
        inst = self._db["institutions"].find_one({"secret": secret})
        if inst is not None:
            data["timestamp"] = timestamp
            data["value"] = value
            data["station"] = station
            data["latitude"] = latitude
            data["longitude"] = longitude
            self._db["sealeveldata"].insert(data)
            return jssuccess()
        else:
            return jsdeny()

application = startapp( FeederSrv )
