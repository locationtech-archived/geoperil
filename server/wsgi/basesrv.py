#!/usr/bin/env python3
from base import *

class BaseSrv:
    def __init__(self,db):
        self._db = db

    @cherrypy.expose
    def index(self):
        s = ""
        for n in dir(self):
            if n not in ["index"]:
                m = self.__getattribute__(n)
                if inspect.ismethod(m) and hasattr(m,"exposed") and m.exposed:
                    spec = inspect.getfullargspec(m)
                    s += "<li><b>%s</b> %s<br>" % (n, inspect.formatargspec(*spec))
        return "<html><ul>%s</ul></html>" % s

    def getUser(self):
        if "server_cookie" in cherrypy.request.cookie:
            uuid = cherrypy.request.cookie["server_cookie"].value
            return self._db["users"].find_one({"session":uuid})
        return None

    def auth_shared(self, evtId):
        if "auth_shared" in cherrypy.request.cookie:
            auth = cherrypy.request.cookie["auth_shared"].value
            try:
                objId = ObjectId(auth)
                return self._db["shared_links"].find({"_id":objId,"evtid":evtId}).count() > 0
            except InvalidId:
                return False
        return False

    def auth_api(self, key, kind):
        if kind == "user":
            return self._db["users"].find_one({"apikey":key})
        if kind == "inst":
            return self._db["inst"].find_one({"apikey":key})
        return None

    def get_hostname(self):
        url = urlparse(cherrypy.url())
        return url.scheme + "://" + url.hostname

    def feed_hazard_event(self,event):
        if "eventid" in event:
            ev = self._db["hazard_events"].find_one({"eventid":event["eventid"]})
            if ev is None:
                self._db["hazard_events"].insert(event)
                return jssuccess()
            return jsfail(errors = ["eventid already assigned."])
        return jsfail(errors = ["eventid missing."])

    def get_hazard_event(self, **parameters):
        parameters = {
            "margin_x":0.1,
            "margin_y":0.1,
            "margin_mag":1,
            "margin_depth":10,
        }.update(parameters)
        query={}
        for name,value in parameters.items():
            if not name.startswith("margin_"):
                try:
                    value = float(value)
                    if "margin_"+name in parameters:
                        margin = float(parameters["margin_"+name])
                        query[name] = {"$gte":value-margin, "$lte":value+margin}
                    else:
                        query[name] = value
                except ValueError:
                    query[name] = value
        events = self._db["hazard_events"].find(query)
        return jssuccess(hazard_events = list(events))
