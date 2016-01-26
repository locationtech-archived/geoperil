from basesrv import *
import glob
import surfer
import requests

logger = logging.getLogger("DataSrv")

class DataSrv(BaseSrv):
    INFO = """<ul>
    <li><b>&lt;EventID&gt;/</b> - List of Products for Event</li>
    <li><b>&lt;EventID&gt;/&lt;Product&gt;</b> - get Products for Event</li>
    <li><b>&lt;EventSetID&gt;/</b> - List of Products for EventSet</li>
    <li><b>&lt;EventSetID&gt;/&lt;Product&gt;</b> - get Products for EventSet</li>
    <li><b>&lt;EventSetID&gt;/&lt;EventID&gt;/</b> - List of Products for Event in EventSet</li>
    <li><b>&lt;EventSetID&gt;/&lt;EventID&gt;/&lt;Product&gt;</b> - get Products for Event in EventSet</li>
</ul>
<h3>Products:</h3>
<ul>
    <li><h4>maxWaveHeights.grd</h4>
        Binary SurferGrid with maximum waveheights
    </li>
    <li><h4>travelTimes.grd</h4>
        Binary SurferGrid with estimated arrival times
    </li>
    <li><h4>cfzs.gmt</h4>
        Coastal Forecast Zones as Polygons in GMT format
    </li>
    <li><h4>tfps.csv</h4>
        Tsunami Forecast Points as csv file
    </li>
    <li><h4>eq.csv</h4>
        Earthquake parameters as csv file
    </li>
    <li><h4>wavejets_traveltimes.png</h4>
        Image with wavejets and TravelTimes
    </li>
    <li><h4>tl.csv?lon=&lt;longitude&gt;&amp;lat=&lt;latitude&gt;[&amp;minint=&lt;minimum interval&gt;]</h4>
        Waveform at the point specified by the mandatory parameter 'lon' and 'lat'.<br>
        Optional parameter 'minint' can be given to request a minimum interval between values, default is 10 minutes.
    </li>
</ul>
"""

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

    def check_access(self,ev,user):
        uinstid = user["inst"] if "inst" in user and user["inst"] is not None else None
        if ev["user"] == user["_id"] or ev["user"] == uinstid:
            return True
        else:
            oinst = self._db["institutions"].find_one({"_id":ev["user"]})
            if oinst is not None and "public_events" in oinst and oinst["public_events"]:
                return True
        return False

    def list_products(self,ev):
        url = self.get_url()
        if not url.endswith("/"):
            raise HTTPRedirect(self.get_hostname()+"/"+url+"/")
        links = []
        if "evtids" in ev:
            links.append("maxWaveHeights.grd")
            for evid in ev["evtids"]:
                links.append("%s/" % evid)
        else:
            links.append("maxWaveHeights.grd")
            links.append("travelTimes.grd")
            links.append("wavejets_traveltimes.png")
            links.append("cfzs_tfps.png")
            links.append("cfzs.gmt")
            links.append("tfps.csv")
            links.append("eq.csv")
        return self.links2html(links)

    def links2html(self,links):
        s = ""
        for l in links:
            s += "<a href='%s'>%s</a><br>" % (l,l)
        return "<html><body>%s</body></html>" % s

    def serve_product(self,ev,product,**kwargs):
        print("S: %s [%s]" % (product,",".join(["%s=%s" % x for x in kwargs.items()])))
        if product in ["maxWaveHeights.grd","travelTimes.grd"]:
            if self.mk_product(ev,product,**kwargs):
                f = os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],product)
                return serve_file(f,"application/octet-stream",'attachment',product)
        elif product in ["cfzs.gmt","tfps.csv","eq.csv"]:
            if self.mk_product(ev,product,**kwargs):
                f = os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],product)
                return serve_file(f,"text/plain")
        elif product in ["wavejets_traveltimes.png","cfzs_tfps.png"]:
            if self.mk_product(ev,product,**kwargs):
                f = os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],product)
                return serve_file(f,"image/png")
        elif product == "tl.csv" and "row" in kwargs and "col" in kwargs and "lat" in kwargs and "lon" in kwargs:
            lat = float(kwargs.pop("lat"))
            lon = float(kwargs.pop("lon"))
            row = int(kwargs.pop("row"))
            col = int(kwargs.pop("col"))
            minint = int(kwargs.get("minint",10))
            if self.mk_product(ev,"tl.csv",row=row,col=col,lat=lat,lon=lon,**kwargs):
                csvfile = os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"tl%d_%d_%d.csv" % (minint,row,col))
                return serve_file(csvfile,"text/plain","tl%d_%d_%d.csv" % (minint,row,col))
        elif product == "tl.csv" and "lat" in kwargs and "lon" in kwargs:
            lat = float(kwargs["lat"])
            lon = float(kwargs["lon"])
            if self.mk_product(ev,"travelTimes.grd",dt=1,**kwargs):
                inf = os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"travelTimes.grd")
                f = open(inf,"rb")
                sf = surfer.SurferFile(f)
                row,col = sf.getRowColFromLatLon(lat,lon)
                f.close()
                return self.serve_product(ev,product,row=row,col=col,**kwargs)
        else:
            raise HTTPError("404 Product not available.")
        raise HTTPError("404 Product could not be created.")

    def mk_product(self,ev,product,**kwargs):
        print("MK: %s [%s]" % (product,",".join(["%s=%s" % x for x in kwargs.items()])))
        f = os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],product)
        if product == "maxWaveHeights.grd":
            if os.path.isfile(f):
                return True
            elif self.mk_product(ev,"eWave.2D.sshmax",**kwargs):
                inf = os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"eWave.2D.sshmax")
                os.rename(inf,f)
                return True
        elif product == "travelTimes.grd":
            if os.path.isfile(f):
                return True
            elif self.mk_product(ev,"eWave.2D.time",**kwargs):
                inf = os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"eWave.2D.time")
                os.rename(inf,f)
                return True
        elif product == "wavejets_traveltimes.png":
            if os.path.isfile(f):
                return True
            elif self.mk_product(ev,"travelTimes.grd",**kwargs) and self.mk_product(ev,"maxWaveHeights.grd",**kwargs):
                self.exec_gmt(
                    output = "%s.ps" % f[:-4],
                    wave_height = os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"maxWaveHeights.grd"),
                    wave_height_expression = "0.05",
                    wave_time = os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"travelTimes.grd"),
                    plot_dem = "Y",
                    plot_wave_height = "Y",
                    plot_wave_time = "Y",
                )
                return os.path.isfile(f)
        elif product == "cfzs_tfps.png":
            if os.path.isfile(f):
                return True
            elif self.mk_product(ev,"cfzs.gmt",**kwargs) and self.mk_product(ev,"tfps.csv",**kwargs):
                whf = os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"maxWaveHeights.grd")
                ttf = os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"travelTimes.grd")

                self.exec_gmt(
                    output = "%s.ps" % f[:-4],
                    cfz = os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"cfzs.gmt"),
                    tfp = os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"tfps.csv"),
                    plot_dem = "Y",
                    plot_cfz = "Y",
                    plot_tfp = "Y",
                )
                return os.path.isfile(f)
        elif product == "cfzs.gmt":
            if os.path.isfile(f):
                return True
            elif self.event_stat(ev["_id"]) == 100:
                buf = self.export_cfzs(ev["_id"],0.05)
                if buf is not None:
                    fobj = open(f,"wt")
                    fobj.write(buf)
                    fobj.close()
                    return True
        elif product == "tfps.csv":
            if os.path.isfile(f):
                return True
            elif self.event_stat(ev["_id"]) == 100:
                buf = self.export_tfps(ev["_id"])
                fobj = open(f,"wt")
                fobj.write(buf)
                fobj.close()
                return True
        elif product == "eq.csv":
            if os.path.isfile(f):
                return True
            elif self.event_stat(ev["_id"]) == 100:
                prop = ["longitude","latitude","magnitude","depth","date","strike","dip","rake","region","sea_area"]
                buf = []
                for p in prop:
                    s = str(ev["prop"][p]) if p in ev["prop"] else str(None)
                    buf.append(s.replace(","," "))
                fobj = open(f,"wt")
                fobj.write((",".join(prop)) + "\n")
                fobj.write((",".join(buf)) + "\n")
                fobj.close()
                return True
        elif product == "tl.csv" and "col" in kwargs and "col" in kwargs and "lat" in kwargs and "lon" in kwargs:
            minint = int(kwargs.get("minint",10))
            csvfile = os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"tl%d_%d_%d.csv" % \
                        (minint,kwargs["row"],kwargs["col"]))
            if os.path.isfile(csvfile):
                return True
            elif self.extractCsvFromGrids(ev["_id"],csvfile,kwargs["lat"],kwargs["lon"],minint):
                return True
            elif self.mk_product(ev,"eWave.2D.00060.ssh",dt=1,**kwargs):
                return self.extractCsvFromGrids(ev["_id"],csvfile,kwargs["lat"],kwargs["lon"],minint)
        elif product in ["eWave.2D.sshmax", "eWave.2D.time", "eWave.2D.00060.ssh"]:
            if os.path.isfile(f):
                return True
            elif "apikey" in kwargs:
                if product == "eWave.2D.00060.ssh" and "dt" not in kwargs:
                    kwargs["dt"] = 1
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
            else:
                print("Need API key to trigger simulation.")
        return False

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
            if res is not None and res["ewh"] >= minewh:
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
        out = "# @VGMT1.0 @GPOLYGON\n" + ("# @R%f/%f/%f/%f\n" % (w,e,s,n)) + out
        return out if num > 0 else None

    def export_tfps(self, evtid):
        out = "longitude,latitude,ewh,eta\n"
        for tfp_comp in self._db["tfp_comp"].find({"EventID": evtid}):
            tfp = self._db["tfps"].find_one({"_id": ObjectId(tfp_comp["tfp"])})
            if tfp is None:
                continue
            out += "%f,%f,%f,%f\n" % (tfp["lon_real"], tfp["lat_real"], tfp_comp["ewh"], tfp_comp["eta"])
        return out
        
application = startapp( DataSrv )
