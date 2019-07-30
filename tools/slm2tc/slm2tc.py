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

import os
import sys
import json
import datetime
import calendar
from multiprocessing.pool import ThreadPool
import threading
import requests

IOCSLMSRV = "http://www.ioc-sealevelmonitoring.org/service.php"
TIMEOUT = 600

DETAILLIST = [
    'Location',
    'units',
    'type',
    'countryname',
    'UTCOffset',
    'country',
    'offset'
]

DETAILLIST_SENSOR = DETAILLIST.append('sensor')


def limitruntime(runargs):
    func, rargs, limit = runargs
    thread = threading.Thread(target=func, args=(rargs,))
    thread.daemon = True
    thread.start()
    thread.join(limit)
    if thread.is_alive():
        print("Thread %s won't stop." % str(thread.ident))


def getdataforstation(configargs):
    stconfig, sensor = configargs
    data = []
    para = {"query": "data", "code": sensor["slmcode"]}
    if "sensor" in sensor:
        para["includesensors[]"] = sensor["sensor"]
    if sensor["lasttimestamp"] is not None:
        para["timestart"] = datetime.datetime \
            .utcfromtimestamp(sensor["lasttimestamp"]) \
            .strftime('%Y-%m-%dT%H:%M:%S')
    else:
        para["timestart"] = (
            datetime.datetime.utcnow() -
            datetime.timedelta(days=7)
        ).strftime('%Y-%m-%dT%H:%M:%S')
    try:
        print(
            "Requesting values for %s since %s..." % (
                sensor["name"],
                para["timestart"]
            )
        )
        sdata = requests.get(IOCSLMSRV, params=para, timeout=TIMEOUT)
        sdata = json.loads(sdata.text)
        for dat in sdata:
            dtime = datetime.datetime.strptime(
                dat["stime"].strip(), '%Y-%m-%d %H:%M:%S'
            )
            tst = calendar.timegm(dtime.utctimetuple())
            val = dat["slevel"]
            data.append({"timestamp": tst, "value": str(val)})
            if sensor["lasttimestamp"] is None or \
                    tst > sensor["lasttimestamp"]:
                sensor["lasttimestamp"] = tst
        if data != []:
            print(
                "Inserting %d data values for %s..." % (
                    len(data),
                    sensor["name"]
                )
            )
            params = {
                "apiver": "2",
                "inst": stconfig["inst"],
                "secret": stconfig["secret"],
                "station": sensor["name"],
                "dataformat": "simple",
                "json": json.dumps(data),
            }
            sfeed = requests.post(
                stconfig["feedurl"] + "/feedsealevel",
                data=params,
                timeout=TIMEOUT
            ).json()
            print("%s: " % sensor["name"], sfeed)
        else:
            print("%s: No values to insert." % sensor["name"])
    except Exception as ex:
        print("Error %s: " % sensor["name"], ex)
    sys.stdout.flush()
    sys.stderr.flush()


def updatestationmetadata(config):
    count = 0
    for sname, stat in config["stations"].items():
        count += 1
        print(
            "Updating station metadata %d/%d: %s..." % (
                count,
                len(config["stations"]),
                stat["name"]
            ),
            end=""
        )
        sdetail = requests.get(
            IOCSLMSRV,
            params={"query": "station", "code": stat["slmcode"]},
            timeout=TIMEOUT
        ).json()
        news = {
            "name": sname,
            "slmcode": stat["slmcode"],
            "lon": float(sdetail["Lon"]),
            "lat": float(sdetail["Lat"]),
        }
        if "sensor" in stat:
            news["sensor"] = stat["sensor"]
        for det in DETAILLIST:
            val = sdetail.get(det, None)
            if val is not None:
                news[det] = val
        params = {
            "apiver": "1",
            "inst": config["inst"],
            "secret": config["secret"],
            "station": json.dumps(news)
        }
        sfeed = requests.post(
            config["feedurl"] + "/feedstation",
            data=params,
            timeout=TIMEOUT
        ).json()
        print(sfeed)
        news["lasttimestamp"] = stat["lasttimestamp"]
        config["stations"][sname] = news
    print("Updating station metadata done.")


def loadconfig(configfile):
    if os.path.exists(configfile):
        print("Loading configuration file %s." % configfile)
        cfg = open(configfile, "r")
        config = json.load(cfg)
        cfg.close()
        return config

    print("Configuration file %s does not exist." % configfile)
    sys.exit()


def saveconfig(configfile, config):
    cfg = open(configfile, "w")
    json.dump(config, cfg, indent=4)
    cfg.close()


def main():
    configfile = "config.json"
    cmd = "retrievedata"

    if len(sys.argv) > 1:
        configfile = sys.argv[1]
        if len(sys.argv) > 2:
            cmd = sys.argv[2]

    if cmd == "retrievedata":
        config = loadconfig(configfile)
        args = []
        for stat in config["stations"].values():
            args.append((getdataforstation, (config, stat), TIMEOUT * 5))
        tpool = ThreadPool(config["threads"])
        tpool.map(limitruntime, args)
        saveconfig(configfile, config)
    elif cmd == "updatemetadata":
        config = loadconfig(configfile)
        updatestationmetadata(config)
        saveconfig(configfile, config)
    elif cmd == "updatestations":
        config = loadconfig(configfile)

        newstations = []
        oldstations = list(config["stations"].keys())

        stationlist = requests.get(
            IOCSLMSRV,
            params={"query": "stationlist"},
            timeout=TIMEOUT
        ).json()
        for stat in stationlist:
            stationname = stat["Code"]
            if "sensor" in stat and stat["sensor"] is not None:
                stationname += "_" + stat["sensor"]
            if stationname in oldstations:
                oldstations.remove(stationname)
            elif stationname in config["stations"]:
                print("Duplicate entry for %s in SLM." % stationname)
            else:
                newstations.append(stationname)
                config["stations"][stationname] = {}
                config["stations"][stationname]["name"] = stationname
                config["stations"][stationname]["lasttimestamp"] = None
            config["stations"][stationname]["slmcode"] = stat["Code"]
            config["stations"][stationname]["lon"] = stat["Lon"]
            config["stations"][stationname]["lat"] = stat["Lat"]
            for det in DETAILLIST_SENSOR:
                val = stat.get(det, None)
                if val is not None:
                    config["stations"][stationname][det] = val
        if newstations != []:
            print("New stations in SLM (%d):" % len(newstations))
            for stat in newstations:
                print("    %s" % stat)
        if oldstations != []:
            print(
                "Old stations no longer provided by SLM (%d):" %
                len(oldstations)
            )
            for stat in oldstations:
                print("    %s" % stat)
            if len(sys.argv) > 3 and sys.argv[3] == "remove":
                for stat in oldstations:
                    del config["stations"][stat]
                print("removed.")
        saveconfig(configfile, config)
    elif cmd == "genconfig":
        print("Creating configuration file %s..." % configfile)
        config = {
            "feedurl": "",
            "inst": "",
            "secret": "",
            "threads": 4,
            "stations": {}
        }
        stationlist = requests.get(
            IOCSLMSRV,
            params={"query": "stationlist"},
            timeout=TIMEOUT
        ).json()
        for stat in stationlist:
            stationname = stat["Code"]
            if "sensor" in stat and stat["sensor"] is not None:
                stationname += "_" + stat["sensor"]
            config["stations"][stationname] = {}
            config["stations"][stationname]["name"] = stationname
            config["stations"][stationname]["slmcode"] = stat["Code"]
            config["stations"][stationname]["lon"] = stat["Lon"]
            config["stations"][stationname]["lat"] = stat["Lat"]
            config["stations"][stationname]["lasttimestamp"] = None
            for det in DETAILLIST_SENSOR:
                val = stat.get(det, None)
                if val is not None:
                    config["stations"][stationname][det] = val

        saveconfig(configfile, config)
    else:
        print("Command %s not known." % cmd)


if __name__ == "__main__":
    main()
