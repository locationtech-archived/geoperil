from basesrv import *
import glob
import surfer
import requests

logger = logging.getLogger("DataSrv")
#config = loadconfig("oldconfig.cfg")

class DataSrv(BaseSrv):
    def triggerSim(self,evid,apikey,dt_out):
        print("Retriggering simulation %s..." % evid)
        r = requests.post("http://trideccloud.gfz-potsdam.de/srv/computeById",
            data={"apikey":apikey,"evtid":evid,"dt_out":dt_out,"raw":1})
        stat = None
        timeout = 1200
        print("Waiting for simulation %s..." % evid)
        while stat!="success" and timeout>0:
            r = requests.post("http://trideccloud.gfz-potsdam.de/srv/status",
                data={"apikey":apikey,"evtid":evid,"raw":1})
            stat = r.json()["comp"]
            time.sleep(10)
            timeout -= 10
        print("Simulation %s ended with state: %s" % (evid,stat))
        f1 = os.path.join(config["eventdata"]["eventdatadir"],evid,"eWave.2D.sshmax")
        f2 = os.path.join(config["eventdata"]["eventdatadir"],evid,"eWave.2D.time")
        while not (os.path.isfile(f1) and os.path.isfile(f2)) and timeout>0:
            time.sleep(10)
            timeout -= 10
        time.sleep(10)
        return stat == "success"

    @cherrypy.expose
    def getTravelTimes(self,evid,apikey,format="surferbin"):
        if self.auth_api(apikey) is None:
            raise HTTPError("401 Unauthorized")
        if self._db["eqs"].find_one({"id":evid}) is None:
            raise HTTPError("404 Event %s does not exist." % evid)
        if format == "surferbin":
            ttfile = os.path.join(config["eventdata"]["eventdatadir"],evid,"eWave.2D.time")
            if os.path.isfile(ttfile):
                return serve_file(ttfile,"application/octet-stream",'attachment',evid+"_travelTimes.grd")
            else:
                if self.triggerSim(evid,apikey,0) and os.path.isfile(ttfile):
                    return serve_file(ttfile,"application/octet-stream",'attachment',evid+"_travelTimes.grd")
            raise HTTPError("404 Event %s is faulty." % evid)
        raise HTTPError("404 Format %s not available." % format)

    @cherrypy.expose
    def getProperties(self,evid,apikey):
        if self.auth_api(apikey) is None:
            raise HTTPError("401 Unauthorized")
        ev = self._db["eqs"].find_one({"id":evid})
        if ev is None:
            raise HTTPError("404 Event %s does not exist." % evid)
        return jssuccess(**{"prop":ev["prop"],"process":ev["process"]})

    @cherrypy.expose
    def getMaxWaveHeights(self,evid,apikey,format="surferbin"):
        if self.auth_api(apikey) is None:
            raise HTTPError("401 Unauthorized")
        if self._db["eqs"].find_one({"id":evid}) is None:
            raise HTTPError("404 Event %s does not exist." % evid)
        if format == "surferbin":
            whfile = os.path.join(config["eventdata"]["eventdatadir"],evid,"eWave.2D.sshmax")
            if os.path.isfile(whfile):
                return serve_file(whfile,"application/octet-stream",'attachment',evid+"_maxWaveHeights.grd")
            else:
                if self.triggerSim(evid,apikey,0) and os.path.isfile(whfile):
                    return serve_file(whfile,"application/octet-stream",'attachment',evid+"_maxWaveHeights.grd")
            raise HTTPError("404 Event %s is faulty." % evid)
        raise HTTPError("404 Format %s not available." % format)

    @cherrypy.expose
    def getWaveHeights(self,evid,time=None,apikey=None,format="surferbin"):
        if self.auth_api(apikey) is None:
            raise HTTPError("401 Unauthorized")
        if self._db["eqs"].find_one({"id":evid}) is None:
            raise HTTPError("404 Event %s does not exist." % evid)
        time = intdef(time,None)
        if time is not None:
            if format == "surferbin":
                whfile = os.path.join(config["eventdata"]["eventdatadir"],evid,"eWave.2D.%s.ssh" % str(time).zfill(5))
                if os.path.isfile(whfile):
                    return serve_file(whfile,"application/octet-stream",'attachment',evid+"_WaveHeights_%s.grd" % str(time).zfill(5))
                raise HTTPError("404 Data %d in %s does not exist." % (time,evid))
            raise HTTPError("404 Format %s not available." % format)
        else:
            files = glob.glob(os.path.join(config["eventdata"]["eventdatadir"],evid,"eWave.2D.*.ssh"))
            files.sort()
            s = ""
            for f in files:
                t = int(os.path.basename(f).split(".")[2])
                s += "<a href='?time=%d&apikey=%s&format=%s'>%d</a><br>" % (t,apikey,format,t)
            return "<html><body>%s</body></html>" % s

    @cherrypy.expose
    def getSimData(self,evid,apikey=None):
        if self.auth_api(apikey) is None:
            raise HTTPError("401 Unauthorized")
        if self._db["eqs"].find_one({"id":evid}) is None:
            raise HTTPError("404 Event %s does not exist." % evid)
        s = ""
        for f in ["surferbin"]:
            s += "<h3>Format: %s</h3>" % f
            s += "<a href='/datasrv/getMaxWaveHeights/%s?apikey=%s&format=%s'>%s</a><br>" % \
                (evid,apikey,f,evid+"_maxWaveHeights.grd")
            s += "<a href='/datasrv/getTravelTimes/%s?apikey=%s&format=%s'>%s</a><br>" % \
                (evid,apikey,f,evid+"_travelTimes.grd")
            s += "<a href='/datasrv/getWaveHeights/%s?apikey=%s&format=%s'>%s</a><br>" % \
                (evid,apikey,f,"WaveHeights/")
        return "<html><body>%s</body></html>" % s

    @cherrypy.expose
    def getSetData(self,setid,apikey=None):
        if self.auth_api(apikey) is None:
            raise HTTPError("401 Unauthorized")
        evtset = self._db["evtsets"].find_one({"_id":setid})
        if evtset is None:
            raise HTTPError("404 EventSet %s does not exist." % setid)
        s = ""
        for evid in evtset["evtids"]:
            evt = self._db["eqs"].find_one({"id":evid})
            if len(evt["process"]) > 0 and evt["process"][0]["progress"] == 100:
                s += "<a target='_blank' href='/datasrv/getSimData/%s?apikey=%s'>%s</a><br>" % \
                    (evid,apikey,evid+"/")
            else:
                s += "%s<br>" % (evid+"/")
        return "<html><body>%s</body></html>" % s

    def extractCsvFromGrids(self,evid,csvfile,lat,lon):
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
                if times[n] - times[n-1] > 60:
                    return False
            csvf = open(csvfile,"wt")
            csvf.write("time,value\n")
            for i in range(len(times)):
                csvf.write("%d,%f\n" % (times[i],values[i]))
            csvf.close()
            return True
        return False

    @cherrypy.expose
    def getTimelineLatLon(self,evid,apikey,lat,lon):
        if self.auth_api(apikey) is None:
            raise HTTPError("401 Unauthorized")
        if self._db["eqs"].find_one({"id":evid}) is None:
            raise HTTPError("404 Event %s does not exist." % evid)
        lat = float(lat)
        lon = float(lon)
        whfile = os.path.join(config["eventdata"]["eventdatadir"],evid,"eWave.2D.sshmax")
        if os.path.isfile(whfile) or (self.triggerSim(evid,apikey,1) and os.path.isfile(whfile)):
            f = open(whfile,"rb")
            sf = surfer.SurferFile(f)
            row,col = sf.getRowColFromLatLon(lat,lon)
            f.close()
            if row<0 or col<0 or row>=sf.rows or col>=sf.cols:
                raise HTTPError("404 Position out of Grid.")
            else:
                csvfile = os.path.join(config["eventdata"]["eventdatadir"],evid,"%d_%d.csv" % (row,col))
                if os.path.isfile(csvfile) \
                    or (self.extractCsvFromGrids(evid,csvfile,lat,lon) and os.path.isfile(csvfile)) \
                    or (self.triggerSim(evid,apikey,1) \
                        and self.extractCsvFromGrids(evid,csvfile,lat,lon) \
                        and os.path.isfile(csvfile)):
                    return serve_file(csvfile,"text/plain")
                else:
                    raise HTTPError("404 Data does not exist.")
        else:
            raise HTTPError("404 Event %s is faulty." % evid)
        
application = startapp( DataSrv )
