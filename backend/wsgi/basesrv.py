#!/usr/bin/env python3

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

import sys
import inspect
import subprocess
from urllib.parse import urlparse
from bson.objectid import ObjectId
from bson.objectid import InvalidId
import cherrypy
from base import jsfail, jssuccess, config


class BaseSrv:
    INFO = ""

    def __init__(self, db):
        self._db = db

    @cherrypy.expose
    def index(self):
        res = ""
        for check in dir(self):
            if check not in ["index", "default"]:
                attr = self.__getattribute__(check)
                if inspect.ismethod(attr) and \
                        hasattr(attr, "exposed") and \
                        attr.exposed:
                    spec = inspect.getfullargspec(attr)
                    res += "<li><b>%s</b> %s<br>" % (
                        check,
                        inspect.formatargspec(*spec)
                    )
        return "<html><ul>%s</ul>%s</html>" % (res, self.INFO)

    def setCookie(self, name, value, **kwargs):
        kwargs["path"] = kwargs.pop("path", "/")
        cookie = cherrypy.response.cookie
        cookie[name] = value
        for key, val in kwargs.items():
            cookie[name][key] = val

    def getUser(self):
        if "server_cookie" in cherrypy.request.cookie:
            uuid = cherrypy.request.cookie["server_cookie"].value
            return self._db["users"].find_one({"session": uuid})
        return None

    def auth_shared(self, evtid):
        if "auth_shared" in cherrypy.request.cookie:
            auth = cherrypy.request.cookie["auth_shared"].value
            try:
                objId = ObjectId(auth)
                return self._db["shared_links"].find({
                    "_id": objId,
                    "evtid": evtid
                }).count() > 0
            except InvalidId:
                return False
        return False

    def auth_api(self, key, kind=None):
        if key is not None:
            user = self._db["users"].find_one({
                "api.key": key,
                "api.enabled": True
            })
            inst = self._db["institutions"].find_one({
                "api.key": key,
                "api.enabled": True
            })
            if user is not None and (kind == "user" or kind is None):
                return user if user["permissions"].get("api", False) else None
            if inst is not None and (kind == "inst" or kind is None):
                return inst
        return None

    def check_access(self, event, user):
        if user is not None:
            uinstid = user["inst"] if "inst" in user and \
                user["inst"] is not None else None
            if event["user"] == user["_id"] or event["user"] == uinstid:
                return True
        oinst = self._db["institutions"].find_one({"_id": event["user"]})
        if oinst is not None \
                and "public_events" in oinst and oinst["public_events"]:
            return True
        return False

    def get_hostname(self):
        if "hostname" in config["global"]:
            return config["global"]["hostname"]

        url = urlparse(cherrypy.url())
        return url.scheme + "://" + url.hostname

    def get_url(self):
        return urlparse(cherrypy.url()).path

    def feed_hazard_event(self, event):
        if "eventid" in event:
            findevent = self._db["hazard_events"].find_one({
                "eventid": event["eventid"]
            })
            if findevent is None:
                self._db["hazard_events"].insert(event)
            else:
                self._db["hazard_events"].update(
                    {"eventid": findevent["eventid"]},
                    event
                )
            return jssuccess()
        return jsfail(errors=["eventid missing."])

    def get_hazard_event(self, **parameters):
        default_parameters = {
            "margin_x": 0.2,
            "margin_y": 0.2,
            "margin_mag": 1,
            "margin_depth": 10,
            "margin_time": 300,
        }
        default_parameters.update(parameters)
        parameters = default_parameters
        query = {}
        for name, value in parameters.items():
            if not name.startswith("margin_"):
                try:
                    value = float(value)
                    if "margin_"+name in parameters:
                        margin = float(parameters["margin_"+name])
                        query[name] = {
                            "$gte": value-margin,
                            "$lte": value+margin
                        }
                    else:
                        query[name] = value
                except ValueError:
                    query[name] = value
        events = self._db["hazard_events"].find(query)
        return jssuccess(hazard_events=list(events))

    def html2pdf(self, html):
        if not isinstance(html, (bytes, bytearray)):
            html = bytes(html, "utf-8")

        process = subprocess.Popen(
            ["weasyprint", "-f", "pdf", "-", "-"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        out, err = process.communicate(html)
        print(err.decode("utf-8"))
        return out
