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

from base import *

class Products:
    def __init__(self):
        self._products.extend([
            {
                "file":"maxWaveHeights.grd",
                "shortdesc":"Wave jets - SSH (.grd file)",
                "desc":"Binary SurferGrid with maximum waveheights",
                "show":["evt","evtset","help"],
                "type":"raw",
                "serve":"octet_stream",
                "params":{},
            },
            {
                "file":"travelTimes.grd",
                "shortdesc":"Travel times - ETA (.grd file)",
                "desc":"Binary SurferGrid with estimated arrival times",
                "show":["evt","help"],
                "type":"raw",
                "serve":"octet_stream",
                "params":{},
            },
            {
                "file":"cfzs.gmt",
                "shortdesc":"Coastal Forecast Zones - CFZ (.gmt file)",
                "desc":"Coastal Forecast Zones as Polygons in GMT format",
                "show":["evt","help"],
                "type":"raw",
                "serve":"plain",
                "params":{},
            },
            {
                "file":"tfps.csv",
                "shortdesc":"Tsunami Forecast Points - TFP (.csv file)",
                "desc":"Tsunami Forecast Points as csv file",
                "show":["evt","help"],
                "type":"raw",
                "serve":"plain",
                "params":{},
            },
            {
                "file":"eq.csv",
                "shortdesc":"Earthquake parameters (.csv file)",
                "desc":"Earthquake parameters as csv file",
                "show":["evt","help"],
                "type":"raw",
                "serve":"plain",
                "params":{},
            },
            {
                "file":"wavejets_traveltimes_hq.png",
                "shortdesc":"Wave jets and travel times (.png file 600dpi)",
                "desc":"Image with WaveJets and TravelTimes (600dpi)",
                "show":["evt","help"],
                "type":"png",
                "serve":"png",
                "params":{},
            },
            {
                "file":"wavejets_traveltimes_web.png",
                "shortdesc":"Wave jets and travel times (.png file 300dpi)",
                "desc":"Image with WaveJets and TravelTimes (300dpi)",
                "show":["evt","help"],
                "type":"png",
                "serve":"png",
                "params":{},
            },
            {
                "file":"wavejets_traveltimes_hq.pdf",
                "shortdesc":"Wave jets and travel times (.pdf file 600dpi)",
                "desc":"PDF with WaveJets and TravelTimes (600dpi)",
                "show":["evt","help"],
                "type":"pdf",
                "serve":"octet_stream",
                "params":{},
            },
            {
                "file":"wavejets_traveltimes_web.pdf",
                "shortdesc":"Wave jets and travel times (.pdf file 300dpi)",
                "desc":"PDF with WaveJets and TravelTimes (300dpi)",
                "show":["evt","help"],
                "type":"pdf",
                "serve":"octet_stream",
                "params":{},
            },
            {
                "file":"cfzs_tfps_hq.png",
                "shortdesc":"CFZs and TFPs (.png file 600dpi)",
                "desc":"Image with Coastal Forecast Zones and Tsunami Forecast Points (600dpi)",
                "show":["evt","help"],
                "type":"png",
                "serve":"png",
                "params":{},
            },
            {
                "file":"cfzs_tfps_web.png",
                "shortdesc":"CFZs and TFPs (.png file 300dpi)",
                "desc":"Image with Coastal Forecast Zones and Tsunami Forecast Points (300dpi)",
                "show":["evt","help"],
                "type":"png",
                "serve":"png",
                "params":{},
            },
            {
                "file":"cfzs_tfps_hq.pdf",
                "shortdesc":"CFZs and TFPs (.pdf file 600dpi)",
                "desc":"PDF with WaveJets and TravelTimes (600dpi)",
                "show":["evt","help"],
                "type":"pdf",
                "serve":"octet_stream",
                "params":{},
            },
            {
                "file":"cfzs_tfps_web.pdf",
                "shortdesc":"CFZs and TFPs (.pdf file 300dpi)",
                "desc":"PDF with WaveJets and TravelTimes (300dpi)",
                "show":["evt","help"],
                "type":"pdf",
                "serve":"octet_stream",
                "params":{},
            },
            {
                "file":"cities_population_hq.png",
                "shortdesc":"Cities and population (.png file 600dpi)",
                "desc":"Image with major cities and world population (600dpi)",
                "show":["evt","help"],
                "type":"png",
                "serve":"png",
                "params":{},
            },
            {
                "file":"cities_population_web.png",
                "shortdesc":"Cities and population (.png file 300dpi)",
                "desc":"Image with major cities and world population (300dpi)",
                "show":["evt","help"],
                "type":"png",
                "serve":"png",
                "params":{},
            },
            {
                "file":"cities_population_hq.pdf",
                "shortdesc":"Cities and population (.pdf file 600dpi)",
                "desc":"PDF with WaveJets and TravelTimes (600dpi)",
                "show":["evt","help"],
                "type":"pdf",
                "serve":"octet_stream",
                "params":{},
            },
            {
                "file":"cities_population_web.pdf",
                "shortdesc":"Cities and population (.pdf file 300dpi)",
                "desc":"PDF with WaveJets and TravelTimes (300dpi)",
                "show":["evt","help"],
                "type":"pdf",
                "serve":"octet_stream",
                "params":{},
            },
            {
                "file":"custom.png",
                "shortdesc":"Custom map (.png file)",
                "desc":"Custom map generated according to given parameters",
                "show":["help"],
                "type":"png",
                "serve":"custom_png",
                "params":{"gmt_*":{"desc":"GMT parameters"}},
            },
            {   
                "file":"tl.csv",
                "shortdesc":"Timeline at latitude and longitude (.csv file)",
                "desc":"Waveform at the point specified by the mandatory parameter 'lon' and 'lat'.<br>\n" + \
                       "Optional parameter 'minint' can be given to request a minimum interval between values, default is 10 minutes.",
                "show":["help"],
                "type":"raw",
                "serve":"timeline",
                "params":{
                    "lon":{
                        "desc":"longitude",
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
            return self.rec_create(ev,product,f,kwargs)

    def mk_travelTimes_grd(self,ev,product,f,**kwargs):
        if self.mk_product(ev,"eWave.2D.time",**kwargs):
            inf = os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"eWave.2D.time")
            os.rename(inf,f)
            return self.rec_create(ev,product,f,kwargs)

    def mk_wavejets_traveltimes_hq_pdf(self,ev,product,f,**kwargs):
        return self.mk_png_2_pdf(ev,product,f,**kwargs)

    def mk_wavejets_traveltimes_web_pdf(self,ev,product,f,**kwargs):
        return self.mk_png_2_pdf(ev,product,f,**kwargs)

    def mk_cfzs_tfps_hq_pdf(self,ev,product,f,**kwargs):
        return self.mk_png_2_pdf(ev,product,f,**kwargs)

    def mk_cfzs_tfps_web_pdf(self,ev,product,f,**kwargs):
        return self.mk_png_2_pdf(ev,product,f,**kwargs)

    def mk_cities_population_hq_pdf(self,ev,product,f,**kwargs):
        return self.mk_png_2_pdf(ev,product,f,**kwargs)

    def mk_cities_population_web_pdf(self,ev,product,f,**kwargs):
        return self.mk_png_2_pdf(ev,product,f,**kwargs)

    def mk_png_2_pdf(self,ev,product,f,**kwargs):
        src = product.replace(".pdf",".png")
        if src != product and self.mk_product(ev,src,**kwargs):
            d = os.path.dirname(f)
            fout = open(f,"wb")
            fout.write(self.html2pdf('<html><body><img style="max-width:100%%; max-height:100%%;" src="%s"></body></html>' \
                % os.path.join(d,src)))
            fout.close()
            return self.rec_create(ev,product,f,kwargs)

    def mk_wavejets_traveltimes_hq_png(self,ev,product,f,**kwargs):
        return self.mk_wavejets_traveltimes_png(ev,product,f,dpi=600,**kwargs)

    def mk_wavejets_traveltimes_web_png(self,ev,product,f,**kwargs):
        return self.mk_wavejets_traveltimes_png(ev,product,f,dpi=300,**kwargs)

    def mk_wavejets_traveltimes_png(self,ev,product,f,**kwargs):
        if self.mk_product(ev,"travelTimes.grd",**kwargs) \
                and self.mk_product(ev,"maxWaveHeights.grd",**kwargs) \
                and self.mk_product(ev,"eq.csv",**kwargs) :
            gmtargs = {
                "output" : "%s.ps" % f[:-4],
                "plot_quake" : "Y",
                "quake" : os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"eq.csv"),
                "plot_wave_height" : "Y",
                "wave_height" : os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"maxWaveHeights.grd"),
                "wave_height_expression" : "0.05",
                "plot_wave_time" : "Y",
                "wave_time" : os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"travelTimes.grd"),
                "dpi":str(kwargs["dpi"]) if "dpi" in kwargs else "300",
            }
            r,out = self.exec_gmt(**gmtargs)
            return self.rec_create(ev,product,f,kwargs)

    def mk_cfzs_tfps_hq_png(self,ev,product,f,**kwargs):
        return self.mk_cfzs_tfps_png(ev,product,f,dpi=600,**kwargs)

    def mk_cfzs_tfps_web_png(self,ev,product,f,**kwargs):
        return self.mk_cfzs_tfps_png(ev,product,f,dpi=300,**kwargs)

    def mk_cfzs_tfps_png(self,ev,product,f,**kwargs):
        if self.mk_product(ev,"cfzs.gmt",**kwargs) \
                and self.mk_product(ev,"tfps.csv",**kwargs) \
                and self.mk_product(ev,"eq.csv",**kwargs) :
            gmtargs = {
                "output" : "%s.ps" % f[:-4],
                "plot_quake" : "Y",
                "quake" : os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"eq.csv"),
                "plot_cfz" : "Y",
                "cfz" : os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"cfzs.gmt"),
                "plot_tfp" : "Y",
                "tfp" : os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"tfps.csv"),
                "dpi":str(kwargs["dpi"]) if "dpi" in kwargs else "300",
            }
            r,out = self.exec_gmt(**gmtargs)
            return self.rec_create(ev,product,f,kwargs)

    def mk_cities_population_hq_png(self,ev,product,f,**kwargs):
        return self.mk_cities_population_png(ev,product,f,dpi=600,**kwargs)

    def mk_cities_population_web_png(self,ev,product,f,**kwargs):
        return self.mk_cities_population_png(ev,product,f,dpi=300,**kwargs)

    def mk_cities_population_png(self,ev,product,f,**kwargs):
        if self.mk_product(ev,"maxWaveHeights.grd",**kwargs) and self.mk_product(ev,"eq.csv",**kwargs) :
            gmtargs = {
                "output" : "%s.ps" % f[:-4],
                "plot_cities" : "all",
                "plot_world_pop" : "Y",
                "plot_quake" : "Y",
                "quake" : os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"eq.csv"),
                "wave_height" : os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"maxWaveHeights.grd"),
                "dpi":str(kwargs["dpi"]) if "dpi" in kwargs else "300",
            }
            r,out = self.exec_gmt(**gmtargs)
            return self.rec_create(ev,product,f,kwargs)

    def mk_cfzs_gmt(self,ev,product,f,**kwargs):
        if self.event_stat(ev["_id"]) == 100:
            buf = self.export_cfzs(ev["_id"])
            fobj = open(f,"wt")
            fobj.write(buf)
            fobj.close()
            return self.rec_create(ev,product,f,kwargs)
    
    def mk_tfps_csv(self,ev,product,f,**kwargs):
        if self.event_stat(ev["_id"]) == 100:
            buf = self.export_tfps(ev["_id"])
            fobj = open(f,"wt")
            fobj.write(buf)
            fobj.close()
            return self.rec_create(ev,product,f,kwargs)

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
            return self.rec_create(ev,product,f,kwargs)

    def mk_custom_png(self,ev,product,f,**kwargs):
        if "md5" in kwargs:
            f = os.path.join(os.path.dirname(f),"custom_%s.png" % kwargs["md5"])
            gmtargs = self._db["gmtargs"].find_one({"_id":kwargs["md5"]})
        else:
            gmtargs = {}
            s = []
            for k,v in kwargs.items():
                if k.startswith("gmt_"):
                    gmtargs[k[4:]] = v
                    s.append("%s=%s" % (k[4:],v))
            s.sort()
            s = hashlib.md5(bytes("&".join(s),"utf-8")).hexdigest()
            f = os.path.join(os.path.dirname(f),"custom_%s.png" % s)
            gmtargs["_id"] = s
            self._db["gmtargs"].update({"_id":s},gmtargs,upsert=True)
        if os.path.isfile(f):
            return True
        elif self.mk_product(ev,"cfzs.gmt",**kwargs) \
                and self.mk_product(ev,"tfps.csv",**kwargs) \
                and self.mk_product(ev,"eq.csv",**kwargs) \
                and self.mk_product(ev,"maxWaveHeights.grd",**kwargs) \
                and self.mk_product(ev,"travelTimes.grd",**kwargs) :
            gmtargs.pop("_id",None)
            gmtargs["output"]       = "%s.ps" % f[:-4]
            gmtargs["quake"]        = os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"eq.csv")
            gmtargs["wave_height"]  = os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"maxWaveHeights.grd")
            gmtargs["wave_time"]    = os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"travelTimes.grd")
            gmtargs["cfz"]          = os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"cfzs.gmt")
            gmtargs["tfp"]          = os.path.join(config["eventdata"]["eventdatadir"],ev["_id"],"tfps.csv")
            r,out = self.exec_gmt(**gmtargs)
            return self.rec_create(ev,product,f,kwargs)

    def serve_custom_png(self,ev,product,f,**kwargs):
        if self.mk_product(ev,product,**kwargs):
            s = []
            for k,v in kwargs.items():
                if k.startswith("gmt_"):
                    s.append("%s=%s" % (k[4:],v))
            s.sort()
            s = hashlib.md5(bytes("&".join(s),"utf-8")).hexdigest()
            f = os.path.join(os.path.dirname(f),"custom_%s.png" % s)
            self.rec_request(ev,product,f)
            return self.serve_file(ev,f,"image/png",**kwargs)

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
                return self.serve_file(ev,csvfile,"text/plain",**kwargs)
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
