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
        self.mk_simulation(ev,product,f,**kwargs)
    def mk_eWave_2D_time(self,ev,product,f,**kwargs):
        self.mk_simulation(ev,product,f,**kwargs)
    def mk_eWave_2D_00060_ssh(self,ev,product,f,**kwargs):
        self.mk_simulation(ev,product,f,**kwargs)

    def mk_maxWaveHeights_grd(self,ev,product,f,**kwargs):
        if self.mk_product(ev,"eWave.2D.sshmax",**kwargs):
            inf = os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"eWave.2D.sshmax")
            os.rename(inf,f)
            return True

    def mk_travelTimes_grd(self,ev,product,f,**kwargs):
        if self.mk_product(ev,"eWave.2D.time",**kwargs):
            inf = os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"eWave.2D.time")
            os.rename(inf,f)
            return True

    def mk_wavejets_traveltimes_png(self,ev,product,f,**kwargs):
        if self.mk_product(ev,"travelTimes.grd",**kwargs) \
                and self.mk_product(ev,"maxWaveHeights.grd",**kwargs) \
                and self.mk_product(ev,"eq.csv",**kwargs) :
            gmtargs = {
                "output" : "%s.ps" % f[:-4],
                "quake" : os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"eq.csv"),
                "wave_height" : os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"maxWaveHeights.grd"),
                "wave_height_expression" : "0.05",
                "wave_time" : os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"travelTimes.grd"),
                "plot_dem" : "Y",
                "plot_quake" : "Y",
                "plot_wave_height" : "Y",
                "plot_wave_time" : "Y",
            }
            self.exec_gmt(**gmtargs)
            return os.path.isfile(f)

    def mk_cfzs_tfps_png(self,ev,product,f,**kwargs):
        if self.mk_product(ev,"cfzs.gmt",**kwargs) \
                and self.mk_product(ev,"tfps.csv",**kwargs) \
                and self.mk_product(ev,"eq.csv",**kwargs) :
            gmtargs = {
                "output" : "%s.ps" % f[:-4],
                "quake" : os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"eq.csv"),
                "cfz" : os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"cfzs.gmt"),
                "tfp" : os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"tfps.csv"),
                "plot_dem" : "Y",
                "plot_quake" : "Y",
                "plot_cfz" : "Y",
                "plot_tfp" : "Y",
            }
            self.exec_gmt(**gmtargs)
            return os.path.isfile(f)

    def mk_cities_population_png(self,ev,product,f,**kwargs):
        if self.mk_product(ev,"maxWaveHeights.grd",**kwargs) and self.mk_product(ev,"eq.csv",**kwargs) :
            gmtargs = {
                "output" : "%s.ps" % f[:-4],
                "quake" : os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"eq.csv"),
                "wave_height" : os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"maxWaveHeights.grd"),
                "plot_dem" : "Y",
                "plot_quake" : "Y",
                "plot_cities" : "Y",
                "plot_world_pop" : "Y",
            }
            self.exec_gmt(**gmtargs)
            return os.path.isfile(f)

    def mk_cfzs_gmt(self,ev,product,f,**kwargs):
        if self.event_stat(ev["_id"]) == 100:
            buf = self.export_cfzs(ev["_id"])
            if buf is not None:
                fobj = open(f,"wt")
                fobj.write(buf)
                fobj.close()
                return True
        return False
    
    def mk_tfps_csv(self,ev,product,f,**kwargs):
        if self.event_stat(ev["_id"]) == 100:
            buf = self.export_tfps(ev["_id"])
            fobj = open(f,"wt")
            fobj.write(buf)
            fobj.close()
            return True

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
            return True

    def mk_tl_csv(self,ev,product,f,**kwargs):
        if "col" in kwargs and "col" in kwargs and "lat" in kwargs and "lon" in kwargs:
            minint = int(kwargs.get("minint",10))
            csvfile = os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"tl%d_%d_%d.csv" % \
                        (minint,kwargs["row"],kwargs["col"]))
            if os.path.isfile(csvfile):
                return True
            elif self.extractCsvFromGrids(ev["_id"],csvfile,kwargs["lat"],kwargs["lon"],minint):
                return True
            elif self.mk_product(ev,"eWave.2D.00060.ssh",dt=1,**kwargs):
                return self.extractCsvFromGrids(ev["_id"],csvfile,kwargs["lat"],kwargs["lon"],minint)

    def serve_timeline(self,ev,product,f,**kwargs):
        if product == "tl.csv" and "row" in kwargs and "col" in kwargs and "lat" in kwargs and "lon" in kwargs:
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
