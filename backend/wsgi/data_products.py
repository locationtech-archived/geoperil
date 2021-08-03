# GeoPeril - A platform for the computation and web-mapping of hazard specific
# geospatial data, as well as for serving functionality to handle, share, and
# communicate threat specific information in a collaborative environment.
#
# Copyright (C) 2021 GFZ German Research Centre for Geosciences
#
# SPDX-License-Identifier: Apache-2.0
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#   http://apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the Licence is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the Licence for the specific language governing permissions and
# limitations under the Licence.
#
# Contributors:
#   Johannes Spazier (GFZ)
#   Sven Reissland (GFZ)
#   Martin Hammitzsch (GFZ)
#   Matthias Rüster (GFZ)
#   Hannes Fuchs (GFZ)

import os
import hashlib
from base import config
import surfer


class Products:
    _products = []
    _db = {}

    def __init__(self):
        self._products.extend([
            {
                "file": "maxWaveHeights.grd",
                "shortdesc": "Wave jets - SSH (.grd file)",
                "desc": "Binary SurferGrid with maximum waveheights",
                "show": ["evt", "evtset", "help"],
                "type": "raw",
                "serve": "octet_stream",
                "params": {},
            },
            {
                "file": "travelTimes.grd",
                "shortdesc": "Travel times - ETA (.grd file)",
                "desc": "Binary SurferGrid with estimated arrival times",
                "show": ["evt", "help"],
                "type": "raw",
                "serve": "octet_stream",
                "params": {},
            },
            {
                "file": "cfzs.gmt",
                "shortdesc": "Coastal Forecast Zones - CFZ (.gmt file)",
                "desc": "Coastal Forecast Zones as Polygons in GMT format",
                "show": ["evt", "help"],
                "type": "raw",
                "serve": "plain",
                "params": {},
            },
            {
                "file": "tfps.csv",
                "shortdesc": "Tsunami Forecast Points - TFP (.csv file)",
                "desc": "Tsunami Forecast Points as csv file",
                "show": ["evt", "help"],
                "type": "raw",
                "serve": "plain",
                "params": {},
            },
            {
                "file": "eq.csv",
                "shortdesc": "Earthquake parameters (.csv file)",
                "desc": "Earthquake parameters as csv file",
                "show": ["evt", "help"],
                "type": "raw",
                "serve": "plain",
                "params": {},
            },
            {
                "file": "wavejets_traveltimes_hq.png",
                "shortdesc": "Wave jets and travel times (.png file 600dpi)",
                "desc": "Image with WaveJets and TravelTimes (600dpi)",
                "show": ["evt", "help"],
                "type": "png",
                "serve": "png",
                "params": {},
            },
            {
                "file": "wavejets_traveltimes_web.png",
                "shortdesc": "Wave jets and travel times (.png file 300dpi)",
                "desc": "Image with WaveJets and TravelTimes (300dpi)",
                "show": ["evt", "help"],
                "type": "png",
                "serve": "png",
                "params": {},
            },
            {
                "file": "wavejets_traveltimes_hq.pdf",
                "shortdesc": "Wave jets and travel times (.pdf file 600dpi)",
                "desc": "PDF with WaveJets and TravelTimes (600dpi)",
                "show": ["evt", "help"],
                "type": "pdf",
                "serve": "octet_stream",
                "params": {},
            },
            {
                "file": "wavejets_traveltimes_web.pdf",
                "shortdesc": "Wave jets and travel times (.pdf file 300dpi)",
                "desc": "PDF with WaveJets and TravelTimes (300dpi)",
                "show": ["evt", "help"],
                "type": "pdf",
                "serve": "octet_stream",
                "params": {},
            },
            {
                "file": "cfzs_tfps_hq.png",
                "shortdesc": "CFZs and TFPs (.png file 600dpi)",
                "desc": "Image with Coastal Forecast Zones and Tsunami " +
                        "Forecast Points (600dpi)",
                "show": ["evt", "help"],
                "type": "png",
                "serve": "png",
                "params": {},
            },
            {
                "file": "cfzs_tfps_web.png",
                "shortdesc": "CFZs and TFPs (.png file 300dpi)",
                "desc": "Image with Coastal Forecast Zones and Tsunami " +
                        "Forecast Points (300dpi)",
                "show": ["evt", "help"],
                "type": "png",
                "serve": "png",
                "params": {},
            },
            {
                "file": "cfzs_tfps_hq.pdf",
                "shortdesc": "CFZs and TFPs (.pdf file 600dpi)",
                "desc": "PDF with WaveJets and TravelTimes (600dpi)",
                "show": ["evt", "help"],
                "type": "pdf",
                "serve": "octet_stream",
                "params": {},
            },
            {
                "file": "cfzs_tfps_web.pdf",
                "shortdesc": "CFZs and TFPs (.pdf file 300dpi)",
                "desc": "PDF with WaveJets and TravelTimes (300dpi)",
                "show": ["evt", "help"],
                "type": "pdf",
                "serve": "octet_stream",
                "params": {},
            },
            {
                "file": "cities_population_hq.png",
                "shortdesc": "Cities and population (.png file 600dpi)",
                "desc": "Image with major cities and world population " +
                        "(600dpi)",
                "show": ["evt", "help"],
                "type": "png",
                "serve": "png",
                "params": {},
            },
            {
                "file": "cities_population_web.png",
                "shortdesc": "Cities and population (.png file 300dpi)",
                "desc": "Image with major cities and world population " +
                        "(300dpi)",
                "show": ["evt", "help"],
                "type": "png",
                "serve": "png",
                "params": {},
            },
            {
                "file": "cities_population_hq.pdf",
                "shortdesc": "Cities and population (.pdf file 600dpi)",
                "desc": "PDF with WaveJets and TravelTimes (600dpi)",
                "show": ["evt", "help"],
                "type": "pdf",
                "serve": "octet_stream",
                "params": {},
            },
            {
                "file": "cities_population_web.pdf",
                "shortdesc": "Cities and population (.pdf file 300dpi)",
                "desc": "PDF with WaveJets and TravelTimes (300dpi)",
                "show": ["evt", "help"],
                "type": "pdf",
                "serve": "octet_stream",
                "params": {},
            },
            {
                "file": "custom.png",
                "shortdesc": "Custom map (.png file)",
                "desc": "Custom map generated according to given parameters",
                "show": ["help"],
                "type": "png",
                "serve": "custom_png",
                "params": {"gmt_*": {"desc": "GMT parameters"}},
            },
            {
                "file": "tl.csv",
                "shortdesc": "Timeline at latitude and longitude (.csv file)",
                "desc": "Waveform at the point specified by the mandatory " +
                        "parameter 'lon' and 'lat'.<br>\n" +
                        "Optional parameter 'minint' can be given to " +
                        "request a minimum interval between values, default " +
                        "is 10 minutes.",
                "show": ["help"],
                "type": "raw",
                "serve": "timeline",
                "params": {
                    "lon": {
                        "desc": "longitude",
                        "mandatory": True,
                    },
                    "lat": {
                        "desc": "latitude",
                        "mandatory": True,
                    },
                    "minint": {
                        "desc": "minimum interval",
                        "mandatory": False,
                    },
                },
            },
        ])

    def mk_product(self, event, product, **kwargs):
        # will be overridden by DataSrv class
        pass

    def mk_simulation(self, event, product, file, **kwargs):
        # will be overridden by DataSrv class
        pass

    def rec_create(self, event, product, file, params=None):
        # will be overridden by DataSrv class
        pass

    def exec_gmt(self, **kwargs):
        # will be overridden by DataSrv class
        pass

    def event_stat(self, evid):
        # will be overridden by DataSrv class
        pass

    def export_cfzs(self, evtid, minewh=0):
        # will be overridden by DataSrv class
        return {}

    def export_tfps(self, evtid, minewh=0):
        # will be overridden by DataSrv class
        return {}

    def serve_file(self, event, file, content_type, **kwargs):
        # will be overridden by DataSrv class
        pass

    def rec_request(self, event, product, file):
        # will be overridden by DataSrv class
        pass

    def extractCsvFromGrids(self, evid, csvfile, lat, lon, minint):
        # will be overridden by DataSrv class
        pass

    def html2pdf(self, *args):
        # will be inherited from BaseSrv class within DataSrv class
        pass

    def mk_eWave_2D_sshmax(self, event, product, file, **kwargs):
        return self.mk_simulation(event, product, file, **kwargs)

    def mk_eWave_2D_time(self, event, product, file, **kwargs):
        return self.mk_simulation(event, product, file, **kwargs)

    def mk_eWave_2D_00060_ssh(self, event, product, file, **kwargs):
        return self.mk_simulation(event, product, file, **kwargs)

    def mk_maxWaveHeights_grd(self, event, product, file, **kwargs):
        if self.mk_product(event, "eWave.2D.sshmax", **kwargs):
            inf = os.path.join(
                config["eventdata"]["eventdatadir"],
                event["_id"], "eWave.2D.sshmax"
            )
            os.rename(inf, file)
            return self.rec_create(event, product, file, kwargs)
        return None

    def mk_travelTimes_grd(self, event, product, file, **kwargs):
        if self.mk_product(event, "eWave.2D.time", **kwargs):
            inf = os.path.join(
                config["eventdata"]["eventdatadir"],
                event["_id"],
                "eWave.2D.time"
            )
            os.rename(inf, file)
            return self.rec_create(event, product, file, kwargs)
        return None

    def mk_wavejets_traveltimes_hq_pdf(self, event, product, file, **kwargs):
        return self.mk_png_2_pdf(event, product, file, **kwargs)

    def mk_wavejets_traveltimes_web_pdf(self, event, product, file, **kwargs):
        return self.mk_png_2_pdf(event, product, file, **kwargs)

    def mk_cfzs_tfps_hq_pdf(self, event, product, file, **kwargs):
        return self.mk_png_2_pdf(event, product, file, **kwargs)

    def mk_cfzs_tfps_web_pdf(self, event, product, file, **kwargs):
        return self.mk_png_2_pdf(event, product, file, **kwargs)

    def mk_cities_population_hq_pdf(self, event, product, file, **kwargs):
        return self.mk_png_2_pdf(event, product, file, **kwargs)

    def mk_cities_population_web_pdf(self, event, product, file, **kwargs):
        return self.mk_png_2_pdf(event, product, file, **kwargs)

    def mk_png_2_pdf(self, event, product, file, **kwargs):
        src = product.replace(".pdf", ".png")
        if src != product and self.mk_product(event, src, **kwargs):
            basedir = os.path.dirname(file)
            fout = open(file, "wb")
            fout.write(
                self.html2pdf(
                    '<html><body><img style="max-width:100%%; ' +
                    'max-height:100%%;" src="%s"></body></html>'
                    % os.path.join(basedir, src)
                )
            )
            fout.close()
            return self.rec_create(event, product, file, kwargs)
        return None

    def mk_wavejets_traveltimes_hq_png(self, event, product, file, **kwargs):
        return self.mk_wavejets_traveltimes_png(
            event, product, file, dpi=600, **kwargs
        )

    def mk_wavejets_traveltimes_web_png(self, event, product, file, **kwargs):
        return self.mk_wavejets_traveltimes_png(
            event, product, file, dpi=300, **kwargs
        )

    def mk_wavejets_traveltimes_png(self, event, product, file, **kwargs):
        if self.mk_product(event, "travelTimes.grd", **kwargs) \
                and self.mk_product(event, "maxWaveHeights.grd", **kwargs) \
                and self.mk_product(event, "eq.csv", **kwargs):
            gmtargs = {
                "output": "%s.ps" % file[:-4],
                "plot_quake": "Y",
                "quake": os.path.join(
                    config["eventdata"]["eventdatadir"],
                    event["_id"],
                    "eq.csv"
                ),
                "plot_wave_height": "Y",
                "wave_height": os.path.join(
                    config["eventdata"]["eventdatadir"],
                    event["_id"],
                    "maxWaveHeights.grd"
                ),
                "wave_height_expression": "0.05",
                "plot_wave_time": "Y",
                "wave_time": os.path.join(
                    config["eventdata"]["eventdatadir"],
                    event["_id"],
                    "travelTimes.grd"
                ),
                "dpi": str(kwargs["dpi"]) if "dpi" in kwargs else "300",
            }
            self.exec_gmt(**gmtargs)
            return self.rec_create(event, product, file, kwargs)
        return None

    def mk_cfzs_tfps_hq_png(self, event, product, file, **kwargs):
        return self.mk_cfzs_tfps_png(event, product, file, dpi=600, **kwargs)

    def mk_cfzs_tfps_web_png(self, event, product, file, **kwargs):
        return self.mk_cfzs_tfps_png(event, product, file, dpi=300, **kwargs)

    def mk_cfzs_tfps_png(self, event, product, file, **kwargs):
        if self.mk_product(event, "cfzs.gmt", **kwargs) \
                and self.mk_product(event, "tfps.csv", **kwargs) \
                and self.mk_product(event, "eq.csv", **kwargs):
            gmtargs = {
                "output": "%s.ps" % file[:-4],
                "plot_quake": "Y",
                "quake": os.path.join(
                    config["eventdata"]["eventdatadir"],
                    event["_id"],
                    "eq.csv"
                ),
                "plot_cfz": "Y",
                "cfz": os.path.join(
                    config["eventdata"]["eventdatadir"],
                    event["_id"],
                    "cfzs.gmt"
                ),
                "plot_tfp": "Y",
                "tfp": os.path.join(
                    config["eventdata"]["eventdatadir"],
                    event["_id"],
                    "tfps.csv"
                ),
                "dpi": str(kwargs["dpi"]) if "dpi" in kwargs else "300",
            }
            self.exec_gmt(**gmtargs)
            return self.rec_create(event, product, file, kwargs)
        return None

    def mk_cities_population_hq_png(self, event, product, file, **kwargs):
        return self.mk_cities_population_png(
            event,
            product,
            file,
            dpi=600,
            **kwargs
        )

    def mk_cities_population_web_png(self, event, product, file, **kwargs):
        return self.mk_cities_population_png(
            event,
            product,
            file,
            dpi=300,
            **kwargs
        )

    def mk_cities_population_png(self, event, product, file, **kwargs):
        if self.mk_product(event, "maxWaveHeights.grd", **kwargs) and \
                self.mk_product(event, "eq.csv", **kwargs):
            gmtargs = {
                "output": "%s.ps" % file[:-4],
                "plot_cities": "all",
                "plot_world_pop": "Y",
                "plot_quake": "Y",
                "quake": os.path.join(
                    config["eventdata"]["eventdatadir"],
                    event["_id"],
                    "eq.csv"
                ),
                "wave_height": os.path.join(
                    config["eventdata"]["eventdatadir"],
                    event["_id"],
                    "maxWaveHeights.grd"
                ),
                "dpi": str(kwargs["dpi"]) if "dpi" in kwargs else "300",
            }
            self.exec_gmt(**gmtargs)
            return self.rec_create(event, product, file, kwargs)
        return None

    def mk_cfzs_gmt(self, event, product, file, **kwargs):
        if self.event_stat(event["_id"]) == 100:
            buf = self.export_cfzs(event["_id"])
            fobj = open(file, "wt")
            fobj.write(buf)
            fobj.close()
            return self.rec_create(event, product, file, kwargs)
        return None

    def mk_tfps_csv(self, event, product, file, **kwargs):
        if self.event_stat(event["_id"]) == 100:
            buf = self.export_tfps(event["_id"])
            fobj = open(file, "wt")
            fobj.write(buf)
            fobj.close()
            return self.rec_create(event, product, file, kwargs)
        return None

    def mk_eq_csv(self, event, product, file, **kwargs):
        if self.event_stat(event["_id"]) == 100:
            prop = [
                "longitude",
                "latitude",
                "magnitude",
                "depth",
                "date",
                "strike",
                "dip",
                "rake",
                "region",
                "sea_area"
            ]
            buf = []
            for pro in prop:
                prostr = str(event["prop"][pro]) \
                    if pro in event["prop"] \
                    else str(None)
                buf.append(prostr.replace(",", " "))
            fobj = open(file, "wt")
            fobj.write((",".join(prop)) + "\n")
            fobj.write((",".join(buf)) + "\n")
            fobj.close()
            return self.rec_create(event, product, file, kwargs)
        return None

    def mk_custom_png(self, event, product, file, **kwargs):
        if "md5" in kwargs:
            file = os.path.join(
                os.path.dirname(file),
                "custom_%s.png" % kwargs["md5"]
            )
            gmtargs = self._db["gmtargs"].find_one({"_id": kwargs["md5"]})
        else:
            gmtargs = {}
            customstr = []
            for key, val in kwargs.items():
                if key.startswith("gmt_"):
                    gmtargs[key[4:]] = val
                    customstr.append("%s=%s" % (key[4:], val))
            customstr.sort()
            customstr = hashlib.md5(
                bytes("&".join(customstr), "utf-8")
            ).hexdigest()
            file = os.path.join(
                os.path.dirname(file),
                "custom_%s.png" % customstr
            )
            gmtargs["_id"] = customstr
            self._db["gmtargs"].update(
                {"_id": customstr},
                gmtargs,
                upsert=True
            )
        if os.path.isfile(file):
            return True
        if self.mk_product(event, "cfzs.gmt", **kwargs) \
                and self.mk_product(event, "tfps.csv", **kwargs) \
                and self.mk_product(event, "eq.csv", **kwargs) \
                and self.mk_product(event, "maxWaveHeights.grd", **kwargs) \
                and self.mk_product(event, "travelTimes.grd", **kwargs):
            gmtargs.pop("_id", None)
            gmtargs["output"] = "%s.ps" % file[:-4]
            gmtargs["quake"] = os.path.join(
                config["eventdata"]["eventdatadir"],
                event["_id"],
                "eq.csv"
            )
            gmtargs["wave_height"] = os.path.join(
                config["eventdata"]["eventdatadir"],
                event["_id"],
                "maxWaveHeights.grd"
            )
            gmtargs["wave_time"] = os.path.join(
                config["eventdata"]["eventdatadir"],
                event["_id"],
                "travelTimes.grd"
            )
            gmtargs["cfz"] = os.path.join(
                config["eventdata"]["eventdatadir"],
                event["_id"],
                "cfzs.gmt"
            )
            gmtargs["tfp"] = os.path.join(
                config["eventdata"]["eventdatadir"],
                event["_id"],
                "tfps.csv"
            )
            self.exec_gmt(**gmtargs)
            return self.rec_create(event, product, file, kwargs)
        return None

    def serve_custom_png(self, event, product, file, **kwargs):
        if self.mk_product(event, product, **kwargs):
            customstr = []
            for key, val in kwargs.items():
                if key.startswith("gmt_"):
                    customstr.append("%s=%s" % (key[4:], val))
            customstr.sort()
            customstr = hashlib.md5(
                bytes("&".join(customstr), "utf-8")
            ).hexdigest()
            file = os.path.join(
                os.path.dirname(file),
                "custom_%s.png" % customstr
            )
            self.rec_request(event, product, file)
            return self.serve_file(event, file, "image/png", **kwargs)
        return None

    def mk_tl_csv(self, event, product, file, **kwargs):
        if "row" in kwargs and \
                "col" in kwargs and \
                "lat" in kwargs and \
                "lon" in kwargs:
            minint = int(kwargs.get("minint", 10))
            lat = float(kwargs.pop("lat"))
            lon = float(kwargs.pop("lon"))
            row = int(kwargs.pop("row"))
            col = int(kwargs.pop("col"))
            params = {
                "minint": minint,
                "row": row,
                "col": col,
                "lat": lat,
                "lon": lon
            }
            csvfile = os.path.join(
                config["eventdata"]["eventdatadir"],
                event["_id"],
                "tl%d_%d_%d.csv" % (minint, row, col)
            )
            if os.path.isfile(csvfile):
                return True
            if self.extractCsvFromGrids(
                    event["_id"],
                    csvfile,
                    lat,
                    lon,
                    minint
            ):
                return self.rec_create(event, product, csvfile, params)
            if self.mk_product(event, "eWave.2D.00060.ssh", dt=1, **kwargs) \
                and self.extractCsvFromGrids(
                        event["_id"],
                        csvfile,
                        lat,
                        lon,
                        minint
                    ):
                return self.rec_create(event, product, csvfile, params)
        return None

    def serve_timeline(self, event, product, file, **kwargs):
        if product == "tl.csv" and \
                "row" in kwargs and \
                "col" in kwargs and \
                "lat" in kwargs and \
                "lon" in kwargs:
            lat = float(kwargs.pop("lat"))
            lon = float(kwargs.pop("lon"))
            row = int(kwargs.pop("row"))
            col = int(kwargs.pop("col"))
            minint = int(kwargs.get("minint", 10))
            if self.mk_product(
                    event,
                    "tl.csv",
                    row=row,
                    col=col,
                    lat=lat,
                    lon=lon,
                    **kwargs
            ):
                csvfile = os.path.join(
                    config["eventdata"]["eventdatadir"],
                    event["_id"],
                    "tl%d_%d_%d.csv" % (minint, row, col)
                )
                self.rec_request(event, product, csvfile)
                return self.serve_file(event, csvfile, "text/plain", **kwargs)
        elif product == "tl.csv" and "lat" in kwargs and "lon" in kwargs:
            lat = float(kwargs["lat"])
            lon = float(kwargs["lon"])
            if self.mk_product(event, "travelTimes.grd", dt=1, **kwargs):
                inf = os.path.join(
                    config["eventdata"]["eventdatadir"],
                    event["_id"],
                    "travelTimes.grd"
                )
                file = open(inf, "rb")
                surf = surfer.SurferFile(file)
                row, col = surf.getRowColFromLatLon(lat, lon)
                file.close()
                return self.serve_timeline(
                    event,
                    product,
                    file,
                    row=row,
                    col=col,
                    **kwargs
                )
        return None
