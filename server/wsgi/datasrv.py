from basesrv import *
import glob
import requests
from data_products import *

logger = logging.getLogger("DataSrv")

class DataSrv(BaseSrv,Products):
    def __init__(self, *args, **kwargs):
        BaseSrv.__init__(self,*args,**kwargs)
        self._products = []
        Products.__init__(self)

        desc = [
            (("EventID",)                       , "List of Products for Event"),
            (("EventID","Product",)             , "Get Products for Event"),
            (("EventSetID",)                    , "List of Products for EventSet"),
            (("EventSetID","Product",)          , "Get Products for EventSet"),
            (("EventSetID","EventID",)          , "List of Products for Event in EventSet"),
            (("EventSetID","EventID","Product",), "Get Products for Event in EventSet"),
        ]
        ds = ""
        for n,d in desc:
            n = "/".join(["&lt;%s&gt;" % x for x in n])
            ds += "<li><b>%s</b> - %s</li>\n" % (n,d)
        s = ""
        for h in self._products:
            if "help" in h["show"]:
                n = h["file"]
                if len(h["params"]) > 0:
                    n += "?"
                    ps = []
                    ops = []
                    for p,d in h["params"].items():
                        p += "=&lt;%s&gt;" % d["desc"]
                        if d["mandatory"]:
                            ps.append("&amp;%s" % p)
                        else:
                            ops.append("[&amp;%s]" % p)
                    n += "".join(ps+ops)
                s += "<li><h4>%s</h4>\n%s\n</li>\n" % (n,h["desc"])
        self.INFO = "<ul>\n%s</ul>\n<h3>Products:</h3>\n<ul>\n%s</ul>" % (ds,s)

    @cherrypy.expose
    def help(self):
        return jssuccess(products=self._products)

    @cherrypy.expose
    def default(self,eid,*args,**kwargs):
        apikey = kwargs.get("apikey",None)
        user = self.getUser() if apikey is None else self.auth_api(apikey) 
        if user is None:
            raise HTTPError("401 Unauthorized")
        ev = self._db["eqs"].find_one({"_id":eid})
        evs = self._db["evtsets"].find_one({"_id":eid})
        if ev is not None:
            if self.check_access(ev,user):
                return self.serve_event(ev,*args,**kwargs)
            else:
                raise HTTPError("403 Forbidden.")
        elif evs is not None:
            if self.check_access(evs,user):
                return self.serve_eventset(evs,*args,**kwargs)
            else:
                raise HTTPError("403 Forbidden.")
        else:
            raise HTTPError("404 Event(set) does not exist.")

    def serve_eventset(self,evs,*args,**kwargs):
        if len(argv)>0 and argv[0] in evs["evtids"]:
            ev = self._db["eqs"].find_one({"_id":argv[0]})
            if ev is not None:
                return self.serve_event(ev,*args[1:],**kwargs)
            else:
                raise HTTPError("404 Event(set) does not exist.")
        else:
            return self.serve_event(evs,*args,**kwargs)

    def serve_event(self,ev,*args,**kwargs):
        if len(args)>0:
            return self.serve_product(ev,args[0],**kwargs)
        else:
            return self.list_products(ev)

    def list_products(self,ev):
        url = self.get_url()
        if not url.endswith("/"):
            raise HTTPRedirect(self.get_hostname()+"/"+url+"/")
        links = []
        if "evtids" in ev:
            for p in self._products:
                if "evtset" in p["show"]:
                    links.append(p["file"])
            for evid in ev["evtids"]:
                links.append("%s/" % evid)
        else:
            for p in self._products:
                if "evt" in p["show"]:
                    links.append(p["file"])
        return self.links2html(links)

    def links2html(self,links):
        s = ""
        for l in links:
            s += "<a href='%s'>%s</a><br>" % (l,l)
        return "<html><body>%s</body></html>" % s

    def serve_octet_stream(self,ev,product,f,**kwargs):
        if self.mk_product(ev,product,**kwargs):
            return serve_file(f,"application/octet-stream",'attachment',product)

    def serve_plain(self,ev,product,f,**kwargs):
        if self.mk_product(ev,product,**kwargs):
            return serve_file(f,"text/plain")

    def serve_png(self,ev,product,f,**kwargs):
        if self.mk_product(ev,product,**kwargs):
            return serve_file(f,"image/png")

    def serve_product(self,ev,product,**kwargs):
        cn = 'download_%s' % ev["_id"].replace("@","_")
        c = cherrypy.response.cookie
        c[cn] = product
        c[cn]['path'] = '/'
        c[cn]['max-age'] = 3600
        c[cn]['version'] = 1

        print("S: %s [%s]" % (product,",".join(["%s=%s" % x for x in kwargs.items()])))
        f = os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],product)
        serve = None
        for p in self._products:
            if p["file"] == product:
                serve = p["serve"]
                break
        fnk = None
        res = None
        if serve is not None:
            try:
                fnk = self.__getattribute__("serve_" + serve)
            except AttributeError:
                pass
        if fnk is None:
            del c[cn]
            raise HTTPError("404 Product not available.")
        res = fnk(ev,product,f,**kwargs)
        if res is None:
            del c[cn]
            raise HTTPError("404 Product could not be created.")
        return res

    def mk_product(self,ev,product,**kwargs):
        print("MK: %s [%s]" % (product,",".join(["%s=%s" % x for x in kwargs.items()])))
        f = os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],product)
        if os.path.isfile(f):
            return True
        try:
            fnk = self.__getattribute__("mk_" + product.replace(".","_"))
            return fnk(ev,product,f,**kwargs) or False
        except AttributeError:
            pass
        return False

    def mk_simulation(self,ev,product,f,**kwargs):
        if product == "eWave.2D.00060.ssh" and "dt" not in kwargs:
            kwargs["dt"] = 1
        stat = self.event_stat(ev["_id"])
        if stat is None or stat == 100:
            print("Retriggering simulation %s..." % ev["_id"])
            self.retriggerSim(ev["_id"],kwargs["dt"] if "dt" in kwargs else 0)
        print("Waiting for simulation %s..." % ev["_id"])
        timeout = 1200
        stat = self.event_stat(ev["_id"])
        if stat is None:
            print("Simulation failed.")
            return False
        while timeout>0 and stat < 100:
            time.sleep(10)
            timeout -= 10
            stat = self.event_stat(ev["_id"])
            print("Simulation %s ended." % ev["_id"])
        while timeout>0 and not os.path.isfile(f):
            time.sleep(10)
            timeout -= 10
        if os.path.isfile(f):
            time.sleep(10)
            return True

    def exec_gmt(self,**kwargs):
        args = [config["GMT"]["report_bin"]]
        for k,v in kwargs.items():
            args.append("--"+k)
            args.append(v)
        print("Executing: %s" % (" ".join(args)))
        p = subprocess.Popen(args, cwd=os.path.dirname(config["GMT"]["report_bin"]))
        p.wait()
        return p.returncode

    def retriggerSim(self,evid,dt_out):
        ev = self._db["eqs"].find_one({"_id":evid})
        if ev is None:
            return False
        user = self._db["users"].find_one({"_id":ev["user"]})
        inst = self._db["institutions"].find_one({"_id":ev["user"]})
        if user is None and inst is None:
            return False
        elif user is None:
            user = inst
        apikey = user.get("api",{}).get("key",None)
        if apikey is None:
            return False
        r = requests.post("http://trideccloud.gfz-potsdam.de/srv/computeById",
            data={"apikey":apikey,"evtid":evid,"dt_out":dt_out,"raw":1})

    def event_stat(self,evid):
        ev = self._db["eqs"].find_one({"_id":evid})
        if "raw_progress" in ev:
            return ev["raw_progress"]
        return None

    def extractCsvFromGrids(self,evid,csvfile,lat,lon,minint=1):
        files = glob.glob(os.path.join(config["eventdata"]["eventdatadir"],evid,"eWave.2D.*.ssh"))
        if len(files) > 0:
            files.sort()
            times = []
            values = []
            for f in files:
                times.append(int(os.path.basename(f).split(".")[2]))
                f = open(f,"rb")
                sf = surfer.SurferFile(f)
                v = sf.getValueAtLatLon(lat,lon)
                values.append(v if v is not None else 0)
                f.close()
            for n in range(1,len(times)):
                if times[n] - times[n-1] > minint*60:
                    return False
            csvf = open(csvfile,"wt")
            csvf.write("time,value\n")
            for i in range(len(times)):
                csvf.write("%d,%f\n" % (times[i],values[i]))
            csvf.close()
            return True
        return False

    def export_cfzs(self, evtid, minewh=0):
        out = "# FEATURE_DATA\n"
        w = 180
        e = -180
        s = 90
        n = -90
        num = 0
        for cfz in self._db["cfcz"].find():
            res = self._db["comp"].find_one({"type": "CFZ", "code": cfz["FID_IO_DIS"], "EventID": evtid})
            if res is not None and res["eta"] >= 0 and res["ewh"] >= minewh:
                val = " -Z%f\n# @P" % res["ewh"]
                for poly in cfz["_COORDS_"]:
                    out += ">%s\n" % val
                    for point in poly:
                        w = point[0] if point[0] < w else w
                        e = point[0] if point[0] > e else e
                        s = point[1] if point[1] < s else s
                        n = point[1] if point[1] > n else n
                        out += "%f %f\n" % (point[0], point[1])
                        num += 1
                    val = "\n# @H"
        if num == 0:
            w = -180
            e = 180
            s = -90
            n = 90
        elif num < 2:
            w -= 1
            e += 1
            s -= 1
            n += 1
        out = "# @VGMT1.0 @GPOLYGON\n" + ("# @R%f/%f/%f/%f\n" % (w,e,s,n)) + out
        return out

    def export_tfps(self, evtid, minewh=0):
        out = "longitude,latitude,ewh,eta\n"
        for tfp_comp in self._db["tfp_comp"].find({"EventID": evtid}):
            tfp = self._db["tfps"].find_one({"_id": ObjectId(tfp_comp["tfp"])})
            if tfp is not None and tfp_comp["ewh"] >= minewh:
                out += "%f,%f,%f,%f\n" % (tfp["lon_real"], tfp["lat_real"], tfp_comp["ewh"], tfp_comp["eta"])
        return out
        
application = startapp( DataSrv )
