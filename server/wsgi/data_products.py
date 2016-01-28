from base import *

class Products:
    def __init__(self):
        self._products.extend([
            {
                "file":"maxWaveHeights.grd",
                "shortdesc":"Max Waveheights",
                "desc":"Binary SurferGrid with maximum waveheights",
                "show":["evt","evtset","help"],
                "serve":"octet_stream",
                "params":{},
            },
            {
                "file":"travelTimes.grd",
                "shortdesc":"Travel Times",
                "desc":"Binary SurferGrid with estimated arrival times",
                "show":["evt","help"],
                "serve":"octet_stream",
                "params":{},
            },
            {
                "file":"cfzs.gmt",
                "shortdesc":"Coastal Forecast Zones",
                "desc":"Coastal Forecast Zones as Polygons in GMT format",
                "show":["evt","help"],
                "serve":"plain",
                "params":{},
            },
            {
                "file":"tfps.csv",
                "shortdesc":"Tsunami Forecast Points",
                "desc":"Tsunami Forecast Points as csv file",
                "show":["evt","help"],
                "serve":"plain",
                "params":{},
            },
            {
                "file":"eq.csv",
                "shortdesc":"EQ params",
                "desc":"Earthquake parameters as csv file",
                "show":["evt","help"],
                "serve":"plain",
                "params":{},
            },
            {
                "file":"wavejets_traveltimes.png",
                "shortdesc":"WaveJets and TravelTimes",
                "desc":"Image with WaveJets and TravelTimes",
                "show":["evt","help"],
                "serve":"png",
                "params":{},
            },
            {
                "file":"cfzs_tfps.png",
                "shortdesc":"CFZs and TFPs",
                "desc":"Image with Coastal Forecast Zones and Tsunami Forecast Points",
                "show":["evt","help"],
                "serve":"png",
                "params":{},
            },
            {
                "file":"cities_population.png",
                "shortdesc":"Cities and World Population",
                "desc":"Image with major cities and world population",
                "show":["evt","help"],
                "serve":"png",
                "params":{},
            },
            {   
                "file":"tl.csv",
                "shortdesc":"",
                "desc":"Waveform at the point specified by the mandatory parameter 'lon' and 'lat'.<br>\n" + \
                       "Optional parameter 'minint' can be given to request a minimum interval between values, default is 10 minutes.",
                "show":["help"],
                "serve":"timeline",
                "params":{
                    "lon":{
                        "desc":"longitue",
                        "mandatory":True,
                    },
                    "lat":{
                        "desc":"latitude",
                        "mandatory":True,
                    },
                    "minint":{
                        "desc":"minimum interval",
                        "mandatory":False,
                    },
                },
            },
        ])

    def mk_eWave_2D_sshmax(self,ev,product,f,**kwargs):
        return self.mk_simulation(ev,product,f,**kwargs)
    def mk_eWave_2D_time(self,ev,product,f,**kwargs):
        return self.mk_simulation(ev,product,f,**kwargs)
    def mk_eWave_2D_00060_ssh(self,ev,product,f,**kwargs):
        return self.mk_simulation(ev,product,f,**kwargs)

    def mk_maxWaveHeights_grd(self,ev,product,f,**kwargs):
        if self.mk_product(ev,"eWave.2D.sshmax",**kwargs):
            inf = os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"eWave.2D.sshmax")
            os.rename(inf,f)
            return self.rec_create(ev,product,f)

    def mk_travelTimes_grd(self,ev,product,f,**kwargs):
        if self.mk_product(ev,"eWave.2D.time",**kwargs):
            inf = os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"eWave.2D.time")
            os.rename(inf,f)
            return self.rec_create(ev,product,f)

    def mk_wavejets_traveltimes_png(self,ev,product,f,**kwargs):
        if self.mk_product(ev,"travelTimes.grd",**kwargs) \
                and self.mk_product(ev,"maxWaveHeights.grd",**kwargs) \
                and self.mk_product(ev,"eq.csv",**kwargs) :
            gmtargs = {
                "output" : "%s.ps" % f[:-4],
                "plot_dem" : "Y",
                "plot_quake" : "Y",
                "quake" : os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"eq.csv"),
                "plot_wave_height" : "Y",
                "wave_height" : os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"maxWaveHeights.grd"),
                "wave_height_expression" : "0.05",
                "plot_wave_time" : "Y",
                "wave_time" : os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"travelTimes.grd"),
            }
            self.exec_gmt(**gmtargs)
            return self.rec_create(ev,product,f)

    def mk_cfzs_tfps_png(self,ev,product,f,**kwargs):
        if self.mk_product(ev,"cfzs.gmt",**kwargs) \
                and self.mk_product(ev,"tfps.csv",**kwargs) \
                and self.mk_product(ev,"eq.csv",**kwargs) :
            gmtargs = {
                "output" : "%s.ps" % f[:-4],
                "plot_dem" : "Y",
                "plot_quake" : "Y",
                "quake" : os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"eq.csv"),
                "plot_cfz" : "Y",
                "cfz" : os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"cfzs.gmt"),
                "plot_tfp" : "Y",
                "tfp" : os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"tfps.csv"),
            }
            self.exec_gmt(**gmtargs)
            return self.rec_create(ev,product,f)

    def mk_cities_population_png(self,ev,product,f,**kwargs):
        if self.mk_product(ev,"maxWaveHeights.grd",**kwargs) and self.mk_product(ev,"eq.csv",**kwargs) :
            gmtargs = {
                "output" : "%s.ps" % f[:-4],
                "plot_dem" : "Y",
                "plot_cities" : "Y",
                "plot_world_pop" : "Y",
                "plot_quake" : "Y",
                "quake" : os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"eq.csv"),
                "wave_height" : os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"maxWaveHeights.grd"),
            }
            self.exec_gmt(**gmtargs)
            return self.rec_create(ev,product,f)

    def mk_cfzs_gmt(self,ev,product,f,**kwargs):
        if self.event_stat(ev["_id"]) == 100:
            buf = self.export_cfzs(ev["_id"])
            fobj = open(f,"wt")
            fobj.write(buf)
            fobj.close()
            return self.rec_create(ev,product,f)
    
    def mk_tfps_csv(self,ev,product,f,**kwargs):
        if self.event_stat(ev["_id"]) == 100:
            buf = self.export_tfps(ev["_id"])
            fobj = open(f,"wt")
            fobj.write(buf)
            fobj.close()
            return self.rec_create(ev,product,f)

    def mk_eq_csv(self,ev,product,f,**kwargs):
        if self.event_stat(ev["_id"]) == 100:
            prop = ["longitude","latitude","magnitude","depth","date","strike","dip","rake","region","sea_area"]
            buf = []
            for p in prop:
                s = str(ev["prop"][p]) if p in ev["prop"] else str(None)
                buf.append(s.replace(","," "))
            fobj = open(f,"wt")
            fobj.write((",".join(prop)) + "\n")
            fobj.write((",".join(buf)) + "\n")
            fobj.close()
            return self.rec_create(ev,product,f)

    def mk_tl_csv(self,ev,product,f,**kwargs):
        if "row" in kwargs and "col" in kwargs and "lat" in kwargs and "lon" in kwargs:
            minint = int(kwargs.get("minint",10))
            lat = float(kwargs.pop("lat"))
            lon = float(kwargs.pop("lon"))
            row = int(kwargs.pop("row"))
            col = int(kwargs.pop("col"))
            params = {"minint":minint,"row":row,"col":col,"lat":lat,"lon":lon}
            csvfile = os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"tl%d_%d_%d.csv" % (minint,row,col))
            if os.path.isfile(csvfile):
                return True
            elif self.extractCsvFromGrids(ev["_id"],csvfile,lat,lon,minint):
                return self.rec_create(ev,product,csvfile,params)
            elif self.mk_product(ev,"eWave.2D.00060.ssh",dt=1,**kwargs) \
                    and self.extractCsvFromGrids(ev["_id"],csvfile,lat,lon,minint):
                return self.rec_create(ev,product,csvfile,params)

    def serve_timeline(self,ev,product,f,**kwargs):
        if product == "tl.csv" and "row" in kwargs and "col" in kwargs and "lat" in kwargs and "lon" in kwargs:
            lat = float(kwargs.pop("lat"))
            lon = float(kwargs.pop("lon"))
            row = int(kwargs.pop("row"))
            col = int(kwargs.pop("col"))
            minint = int(kwargs.get("minint",10))
            if self.mk_product(ev,"tl.csv",row=row,col=col,lat=lat,lon=lon,**kwargs):
                csvfile = os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"tl%d_%d_%d.csv" % (minint,row,col))
                self.rec_request(ev,product,csvfile)
                return self.serve_file(csvfile,"text/plain",**kwargs)
        elif product == "tl.csv" and "lat" in kwargs and "lon" in kwargs:
            lat = float(kwargs["lat"])
            lon = float(kwargs["lon"])
            if self.mk_product(ev,"travelTimes.grd",dt=1,**kwargs):
                inf = os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"travelTimes.grd")
                f = open(inf,"rb")
                sf = surfer.SurferFile(f)
                row,col = sf.getRowColFromLatLon(lat,lon)
                f.close()
                return self.serve_timeline(ev,product,f,row=row,col=col,**kwargs)
