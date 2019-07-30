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

import sys
import json
import datetime
import time
import calendar
from multiprocessing import Process
from queue import Queue
import requests

IOCSLMSRV = "http://www.ioc-sealevelmonitoring.org/service.php"
FEEDURL = "http://trideccloud.gfz-potsdam.de/feedersrv"
INST = "gfz_ex_test"
SECRET = "abcdef"
MAXRANGE = 7 * 24 * 3600    # 1 week
TIMEOUT = 1800
MAXRUNTIME = 1800
PROCESSES = 4


def feeddata(station):
    pstation = {"query": "data", "code": station["slmcode"]}
    if "sensor" in station:
        pstation["includesensors[]"] = station["sensor"]
    params = {
        "apiver": "2",
        "inst": INST,
        "secret": SECRET,
        "station": station["name"],
        "dataformat": "simple",
        "json": json.dumps({}),
    }
    now = time.time()
    sfeed = requests.post(
        FEEDURL + "/feedsealevel",
        data=params,
        timeout=TIMEOUT
    ).json()
    lastts = sfeed.get("lastts", None)
    if lastts is None or now-lastts > MAXRANGE:
        pstation["timestart"] = (
            datetime.datetime.utcfromtimestamp(now - MAXRANGE)
        ).strftime('%Y-%m-%dT%H:%M:%S')
        print(
            "No data yet, or last timestamp out of range. " +
            "Requesting values for %s since %s..." % (
                station["name"],
                pstation["timestart"]
            )
        )
    else:
        pstation["timestart"] = datetime.datetime.utcfromtimestamp(lastts) \
            .strftime('%Y-%m-%dT%H:%M:%S')
        print(
            "Requesting values for %s since %s..." % (
                station["name"],
                pstation["timestart"]
            )
        )
    try:
        data = []
        sdata = requests.get(IOCSLMSRV, params=pstation, timeout=TIMEOUT)
        sdata = json.loads(sdata.text)
        for item in sdata:
            dtime = datetime.datetime.strptime(
                item["stime"].strip(),
                '%Y-%m-%d %H:%M:%S'
            )
            tst = calendar.timegm(dtime.utctimetuple())
            val = item["slevel"]
            data.append({"timestamp": tst, "value": str(val)})
        if data != []:
            print(
                "Inserting %d data values for %s..." % (
                    len(data),
                    station["name"]
                )
            )
            params = {
                "apiver": "2",
                "inst": INST,
                "secret": SECRET,
                "station": station["name"],
                "dataformat": "simple",
                "json": json.dumps(data),
            }
            sfeed = requests.post(
                FEEDURL + "/feedsealevel",
                data=params,
                timeout=TIMEOUT
            ).json()
            print("%s: " % station["name"], sfeed)
        else:
            print("%s: No values to insert." % station["name"])
    except Exception as ex:
        print("Error %s: " % station["name"], ex)
    sys.stdout.flush()
    sys.stderr.flush()


def feedmetadata(station):
    print("Updating station %s metadata..." % station["name"])
    params = {
        "apiver": "1",
        "inst": INST,
        "secret": SECRET,
        "station": json.dumps(station),
    }
    sfeed = requests.post(
        FEEDURL + "/feedstation",
        data=params,
        timeout=TIMEOUT
    ).json()
    return sfeed.get("status") == "success"


def feedall(station):
    if feedmetadata(station):
        feeddata(station)


def main():
    procq = Queue()
    stationlist = requests.get(
        IOCSLMSRV,
        params={"query": "stationlist"},
        timeout=TIMEOUT
    ).json()
    for slist in stationlist:
        stationname = slist["Code"]
        if "sensor" in slist and slist["sensor"] is not None:
            stationname += "_" + slist["sensor"]
        station = {}
        station["name"] = stationname
        station["slmcode"] = slist["Code"]
        station["lon"] = float(slist["Lon"])
        station["lat"] = float(slist["Lat"])
        for key in [
                'Location',
                'units',
                'type',
                'countryname',
                'UTCOffset',
                'country',
                'offset',
                'sensor'
        ]:
            val = slist.get(key, None)
            if val is not None:
                station[key] = val
        procq.put(Process(target=feedall, args=[station]))

    processes = {}
    while (processes != []) or (not procq.empty()):
        now = int(time.time())
        for proctime, proc in list(processes.items()):
            if now - proctime > MAXRUNTIME:
                print("Terminating Process.")
                proc.terminate()
            if not proc.is_alive():
                del processes[proctime]
        if (not procq.empty()) and len(processes) < PROCESSES:
            proc = procq.get()
            proc.start()
            processes[now] = proc
        time.sleep(.01)

    print("Done.")


if __name__ == "__main__":
    main()
