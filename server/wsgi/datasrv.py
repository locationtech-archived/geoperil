from basesrv import *
import glob
import surfer

logger = logging.getLogger("DataSrv")

class DataSrv(BaseSrv):

    @cherrypy.expose
    def getTravelTimes(self,evid,format="surferbin"):
        if format == "surferbin":
            ttfile = os.path.join(config["eventdata"]["eventdatadir"],evid,"eWave.2D.time")
            if os.path.isfile(ttfile):
                return serve_file(ttfile,"application/octet-stream",'attachment',evid+"_travelTimes.grd")
            else:
                #TODO: trigger simulation
                raise HTTPError("404 Event %s does not exist." % evid)
        else:
            raise HTTPError("404 Format %s not available." % format)

    @cherrypy.expose
    def getMaxWaveHeights(self,evid,format="surferbin"):
        if format == "surferbin":
            whfile = os.path.join(config["eventdata"]["eventdatadir"],evid,"eWave.2D.sshmax")
            if os.path.isfile(whfile):
                return serve_file(whfile,"application/octet-stream",'attachment',evid+"_maxWaveHeights.grd")
            else:
                #TODO: trigger simulation
                raise HTTPError("404 Event %s does not exist." % evid)
        else:
            raise HTTPError("404 Format %s not available." % format)

    @cherrypy.expose
    def getTimelineLatLon(self,evid,latitude,longitude):
        latitude = float(latitude)
        longitude = float(longitude)
        whfile = os.path.join(config["eventdata"]["eventdatadir"],evid,"eWave.2D.sshmax")
        if os.path.isfile(whfile):
            f = open(whfile,"rb")
            sf = surfer.SurferFile(f)
            row,col = sf.getRowColFromLatLon(latitude,longitude)
            f.close()
            if row<0 or col<0 or row>=sf.rows or col>=sf.cols:
                raise HTTPError("404 Position out of Grid.")
            else:
                csvfile = os.path.join(config["eventdata"]["eventdatadir"],evid,"%d_%d.csv" % (row,col))
                if not os.path.isfile(csvfile):
                    files = glob.glob(os.path.join(config["eventdata"]["eventdatadir"],evid,"eWave.2D.*.ssh"))
                    if len(files) > 0:
                        files.sort()
                        times = []
                        values = []
                        for f in files:
                            times.append(int(os.path.basename(f).split(".")[2]))
                            f = open(f,"rb")
                            sf = surfer.SurferFile(f)
                            v = sf.getValueAtLatLon(latitude,longitude)
                            values.append(v if v is not None else 0)
                            f.close()
                        csvf = open(csvfile,"wt")
                        csvf.write("time,value\n")
                        for i in range(len(times)):
                            csvf.write("%d,%f\n" % (times[i],values[i]))
                        csvf.close()
                    else:
                        #TODO: trigger advanced simulation
                        raise HTTPError("404 Data does not exist.")
                return serve_file(csvfile,"text/plain")
        else:
            #TODO: trigger advanced simulation
            raise HTTPError("404 Event %s does not exist." % evid)
        
        

application = startapp( DataSrv )
