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
import os
import time
import subprocess
import json
import datetime
import glob
import requests
from bson.objectid import ObjectId
import cherrypy
from cherrypy.lib.static import serve_file as cherrypy_serve_file
from cherrypy._cperror import HTTPError, HTTPRedirect
from base import config, jssuccess, startapp
from basesrv import BaseSrv
from data_products import Products
import surfer

logger = logging.getLogger("DataSrv")


class DataSrv(BaseSrv, Products):
    def __init__(self, *args, **kwargs):
        BaseSrv.__init__(self, *args, **kwargs)
        self._products = []
        Products.__init__(self)

        desc = [
            (
                ("EventID"),
                "List of Products for Event"
            ),
            (
                ("EventID", "Product"),
                "Get Products for Event"
            ),
            (
                ("EventSetID"),
                "List of Products for EventSet"
            ),
            (
                ("EventSetID", "Product"),
                "Get Products for EventSet"
            ),
            (
                ("EventSetID", "EventID"),
                "List of Products for Event in EventSet"
            ),
            (
                ("EventSetID", "EventID", "Product"),
                "Get Products for Event in EventSet"
            ),
        ]
        pstr = ""
        for name, desc in desc:
            name = "/".join(["&lt;%s&gt;" % x for x in name])
            pstr += "<li><b>%s</b> - %s</li>\n" % (name, desc)
        h4str = ""
        for pro in self._products:
            if "help" in pro["show"]:
                name = pro["file"]
                if pro["params"] != []:
                    mps = []
                    ops = []
                    for itm, desc in pro["params"].items():
                        itm += "=&lt;%s&gt;" % desc["desc"]
                        if desc.get("mandatory", False):
                            mps.append("&amp;%s" % itm)
                        else:
                            ops.append("[&amp;%s]" % itm)
                    name += "".join(mps + ops)
                    name = name.replace("&amp;", "?", 1)
                h4str += "<li><h4>%s</h4>\n%s\n</li>\n" % (name, pro["desc"])
        self.INFO = "<ul>\n%s</ul>\n<h3 id=\"products\">Products:" % pstr + \
                    "</h3>\n<ul>\n%s</ul>" % h4str

    @cherrypy.expose
    def help(self):
        return jssuccess(products=self._products)

    @cherrypy.expose
    def gmt_help(self):
        return jssuccess(gmt_params=self.gmt_valid_params())

    @cherrypy.expose
    def default(self, eid, *args, **kwargs):
        apikey = kwargs.get("apikey", None)
        user = self.getUser() if apikey is None else self.auth_api(apikey)
        if user is None:
            user = self._db["users"].find_one(
                {
                    "session": kwargs.pop(
                        "server_cookie",
                        "nonexistant_session"
                    )
                }
            )
        now = datetime.datetime.now()
        if user is None:
            raise HTTPError("401 Unauthorized")
        self._db["log"].insert({
            "addr": "datasrv/*",
            "time": now,
            "eid": eid,
            "user": user["_id"] if user is not None else None,
            "args": args,
            "kwargs": kwargs
        })
        event = self._db["eqs"].find_one({"_id": eid})
        gev = self._db["eqs"].find_one({"id": eid}, sort=[("timestamp", -1)])
        evs = self._db["evtsets"].find_one({"_id": eid})
        if evs is not None:
            if self.check_access(evs, user):
                return self.serve_eventset(evs, *args, **kwargs)
            raise HTTPError("403 Forbidden.")
        if event is not None:
            if self.check_access(event, user):
                return self.serve_event(event, *args, **kwargs)
            raise HTTPError("403 Forbidden.")
        if gev is not None:
            if self.check_access(gev, user):
                return self.serve_event(gev, *args, **kwargs)
            raise HTTPError("403 Forbidden.")
        raise HTTPError("404 Event(set) does not exist.")

    def serve_eventset(self, evs, *args, **kwargs):
        if args != [] and args[0] in evs["evtids"]:
            event = self._db["eqs"].find_one({"_id": args[0]})
            if event is not None:
                return self.serve_event(event, *args[1:], **kwargs)
            raise HTTPError("404 Event(set) does not exist.")
        return self.serve_event(evs, *args, **kwargs)

    def serve_event(self, event, *args, **kwargs):
        if args != []:
            return self.serve_product(event, args[0], **kwargs)
        return self.list_products(event)

    def list_products(self, event):
        url = self.get_url()
        if not url.endswith("/"):
            raise HTTPRedirect(self.get_hostname() + "/" + url + "/")
        links = []
        if "evtids" in event:
            for pro in self._products:
                if "evtset" in pro["show"]:
                    links.append(pro["file"])
            for evid in event["evtids"]:
                links.append("%s/" % evid)
        else:
            for pro in self._products:
                if "evt" in pro["show"]:
                    links.append(pro["file"])
        return self.links2html(links)

    def links2html(self, links):
        res = ""
        for link in links:
            res += "<a href='%s'>%s</a><br>" % (link, link)
        return "<html><body>%s</body></html>" % res

    def serve_file(self, event, file, content_type, **kwargs):
        att = 'attachment' if "download" in kwargs else None
        name = kwargs.get("download", "")
        name = "%s_%s" % (event["_id"], os.path.basename(file)) \
            if name == "" \
            else name
        return cherrypy_serve_file(file, content_type, att, name)

    def serve_octet_stream(self, event, product, file, **kwargs):
        if self.mk_product(event, product, **kwargs):
            self.rec_request(event, product, file)
            return self.serve_file(
                event,
                file,
                "application/octet-stream",
                **kwargs
            )
        return None

    def serve_plain(self, event, product, file, **kwargs):
        if self.mk_product(event, product, **kwargs):
            self.rec_request(event, product, file)
            return self.serve_file(event, file, "text/plain", **kwargs)
        return None

    def serve_png(self, event, product, file, **kwargs):
        if self.mk_product(event, product, **kwargs):
            self.rec_request(event, product, file)
            return self.serve_file(event, file, "image/png", **kwargs)
        return None

    def set_cookie_with_event(self, event, value, **kwargs):
        name = 'download_%s' % event["_id"].replace("@", "_")
        self.setCookie(name, value, **kwargs)

    def serve_product(self, event, product, **kwargs):
        print(
            "S: %s [%s]" % (
                product, ",".join(["%s=%s" % x for x in kwargs.items()])
            )
        )
        file = os.path.join(
            config["eventdata"]["eventdatadir"],
            event["_id"],
            product
        )
        serve = None
        for pro in self._products:
            if pro["file"] == product:
                serve = pro["serve"]
                break
        fnk = None
        res = None
        if serve is not None:
            try:
                fnk = self.__getattribute__("serve_" + serve)
            except AttributeError:
                pass
        if fnk is None:
            self.set_cookie_with_event(event, "not available")
            raise HTTPError("404 Product not available.")
        self.set_cookie_with_event(event, "something wrong")
        res = fnk(event, product, file, **kwargs)
        if res is None:
            raise HTTPError("404 Product could not be created.")
        self.set_cookie_with_event(event, "success")
        return res

    def mk_product(self, event, product, **kwargs):
        self.set_cookie_with_event(event, product)
        print(
            "MK: %s [%s]" % (
                product, ",".join(["%s=%s" % x for x in kwargs.items()])
            )
        )
        file = os.path.join(
            config["eventdata"]["eventdatadir"],
            event["_id"],
            product
        )
        try:
            os.makedirs(os.path.dirname(file), exist_ok=True)
            os.chmod(os.path.dirname(file), 0o777)
        except PermissionError:
            pass
        if os.path.isfile(file):
            return True
        try:
            fnk = self.__getattribute__("mk_" + product.replace(".", "_"))
            return fnk(event, product, file, **kwargs) or False
        except AttributeError:
            pass
        return False

    def mk_simulation(self, event, product, file, **kwargs):
        if product == "eWave.2D.00060.ssh" and "dt" not in kwargs:
            kwargs["dt"] = 1
        stat = self.event_stat(event["_id"])
        if stat is None or stat == 100:
            print("Retriggering simulation %s..." % event["_id"])
            self.retriggerSim(
                event["_id"],
                kwargs["dt"] if "dt" in kwargs else 0
            )
        print("Waiting for simulation %s..." % event["_id"])
        timeout = 1200
        stat = self.event_stat(event["_id"])
        if stat is None:
            print("Simulation failed.")
            self.set_cookie_with_event(event, "simulation failed")
            return False
        while timeout > 0 and stat < 100:
            time.sleep(10)
            timeout -= 10
            stat = self.event_stat(event["_id"])
            print("Simulation %s ended." % event["_id"])
        print("Waiting for file...")
        while timeout > 0 and not os.path.isfile(file):
            time.sleep(10)
            timeout -= 10
        if os.path.isfile(file):
            print("File exists.")
            time.sleep(10)
            return self.rec_create(event, product, file)

        self.set_cookie_with_event(event, "result not available")

    def rec_create(self, event, product, file, params=None):
        if not os.path.isfile(file):
            return False
        doc = {
            "file": file,
            "evid": event["_id"],
            "product": product,
            "created": datetime.datetime.now(),
            "requests": 0,
            "last_request": None,
        }
        if params is not None:
            doc["params"] = params
        self._db["datafiles"].update({"file": file}, doc, upsert=True)
        return True

    def rec_request(self, event, product, file):
        now = datetime.datetime.now()
        self._db["datafiles"].update(
            {"file": file},
            {"$inc": {"requests": 1}, "$set": {"last_request": now}}
        )

    def gmt_valid_params(self):
        return json.loads(
            subprocess.check_output(
                [config["GMT"]["report_bin"], "--print_json", "Y"]
            ).decode("utf-8")
        )

    def exec_gmt(self, **kwargs):
        valid_args = self.gmt_valid_params()
        valid_args = [x["Flag2"].lstrip("-") for x in valid_args]
        args = [config["GMT"]["report_bin"]]
        for key, val in kwargs.items():
            if key in valid_args and isinstance(val, str):
                args.append("--" + key)
                args.append(val)
            else:
                print(
                    "Removing invalid gmt-argument: --%s %s" % (key, str(val))
                )
        print("Executing: %s" % (" ".join(args)))
        proc = subprocess.Popen(
            args,
            cwd=os.path.dirname(config["GMT"]["report_bin"]),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT
        )
        out, _ = proc.communicate()
        return proc.returncode, out

    def retriggerSim(self, evid, dt_out):
        event = self._db["eqs"].find_one({"_id": evid})
        if event is None:
            return False
        user = self._db["users"].find_one({"_id": event["user"]})
        inst = self._db["institutions"].find_one({"_id": event["user"]})
        if user is None and inst is None:
            return False
        if user is None:
            user = inst
        apikey = user.get("api", {}).get("key", None)
        if apikey is None:
            return False
        requests.post(
            self.get_hostname() + "/srv/computeById",
            data={"apikey": apikey, "evtid": evid, "dt_out": dt_out, "raw": 1}
        )
        return True

    def event_stat(self, evid):
        event = self._db["eqs"].find_one({"_id": evid})
        if "raw_progress" in event:
            return event["raw_progress"]
        return None

    def extractCsvFromGrids(self, evid, csvfile, lat, lon, minint=1):
        files = glob.glob(
            os.path.join(
                config["eventdata"]["eventdatadir"],
                evid,
                "eWave.2D.*.ssh"
            )
        )
        if files != []:
            files.sort()
            times = []
            values = []
            for file in files:
                times.append(int(os.path.basename(file).split(".")[2]))
                file = open(file, "rb")
                surf = surfer.SurferFile(file)
                val = surf.getValueAtLatLon(lat, lon)
                values.append(val if val is not None else 0)
                file.close()
            for index in range(1, len(times)):
                if times[index] - times[index - 1] > minint * 60:
                    return False
            csvf = open(csvfile, "wt")
            csvf.write("time,value\n")
            for index, _ in enumerate(times):
                csvf.write("%d,%f\n" % (times[index], values[index]))
            csvf.close()
            return True
        return False

    def export_cfzs(self, evtid, minewh=0):
        out = "# FEATURE_DATA\n"
        val_w = 180
        val_e = -180
        val_w2 = 360
        val_e2 = 0
        val_s = 90
        val_n = -90
        num = 0
        for cfz in self._db["cfcz"].find():
            res = self._db["comp"].find_one({
                "type": "CFZ",
                "code": cfz["FID_IO_DIS"],
                "EventID": evtid
            })
            if res is not None and res["eta"] >= 0 and res["ewh"] >= minewh:
                val = " -Z%f\n# @P" % res["ewh"]
                for poly in cfz["_COORDS_"]:
                    out += ">%s\n" % val
                    for point in poly:
                        val_w = point[0] if point[0] < val_w else val_w
                        val_e = point[0] if point[0] > val_e else val_e
                        val_w2 = point[0] % 360 \
                            if (point[0] % 360) < val_w2 \
                            else val_w2
                        val_e2 = point[0] % 360 \
                            if (point[0] % 360) > val_e2 \
                            else val_e2
                        val_s = point[1] if point[1] < val_s else val_s
                        val_n = point[1] if point[1] > val_n else val_n
                        out += "%f %f\n" % (point[0], point[1])
                        num += 1
                    val = "\n# @H"
        if val_e2 - val_w2 < val_e - val_w:
            val_e = val_e2 if val_e2 <= 180 else val_e2 - 360
            val_w = val_w2 if val_w2 <= 180 else val_w2 - 360
        out = "# @VGMT1.0 @GPOLYGON\n" + \
            ("# @R%f/%f/%f/%f\n" % (val_w, val_e, val_s, val_n)) + \
            out
        return out

    def export_tfps(self, evtid, minewh=0):
        out = "longitude,latitude,ewh,eta\n"
        crs = list(self._db["comp"].find({"EventID": evtid, "type": "TFP"}))
        for tfp_comp in crs:
            tfp = self._db["tfps"].find_one({"_id": ObjectId(tfp_comp["tfp"])})
            if tfp is not None and tfp_comp["ewh"] >= minewh:
                out += "%f,%f,%f,%f\n" % (
                    tfp["lon_real"],
                    tfp["lat_real"],
                    tfp_comp["ewh"],
                    tfp_comp["eta"]
                )
        return out

#    @cherrypy.expose
    def saveformdata(self, _form, **kwargs):
        doc = kwargs.copy()
        doc.pop("_id", None)
        doc["_ip"] = cherrypy.request.headers["X-Forwarded-For"] \
            if "X-Forwarded-For" in cherrypy.request.headers \
            else cherrypy.request.remote.ip
        doc["_form"] = _form
        doc["_time"] = datetime.datetime.now()
        self._db["formdata"].insert(doc)
        return jssuccess()

#    @cherrypy.expose
    def queryformdata(self, _form=None, **kwargs):
        if _form is not None:
            kwargs["_form"] = _form
        data = list(self._db["formdata"].find(kwargs))
        return jssuccess(data=data)


application = startapp(DataSrv)
