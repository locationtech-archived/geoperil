#!/usr/bin/env python3
import requests
import sys
import json
import datetime
import time
import calendar
from multiprocessing import Process
from queue import Queue

IOCSLMSRV = "http://www.ioc-sealevelmonitoring.org/service.php"
FEEDURL = "http://trideccloud.gfz-potsdam.de/feedersrv"
INST = "gfz_ex_test"
SECRET = "abcdef"
MAXRANGE = 7 * 24 * 3600    # 1 week
TIMEOUT = 1800
MAXRUNTIME = 1800
PROCESSES = 4

def feeddata(station):
    p = {"query":"data", "code":station["slmcode"]}
    if "sensor" in station:
        p["includesensors[]"] = station["sensor"]
    params = {
        "apiver":"2", 
        "inst":INST, 
        "secret":SECRET,
        "station":station["name"],
        "dataformat":"simple",
        "json":json.dumps({}),
        }
    now = time.time()
    sfeed = requests.post(FEEDURL+"/feedsealevel", data=params, timeout=TIMEOUT).json()
    lastts = sfeed.get("lastts",None)
    if lastts is None or now-lastts > MAXRANGE:
        p["timestart"] = (datetime.datetime.utcfromtimestamp(now-MAXRANGE)).strftime('%Y-%m-%dT%H:%M:%S')
        print("No data yet, or last timestamp out of range. " + \
            "Requesting values for %s since %s..." % (station["name"],p["timestart"]))
    else:
        p["timestart"] = datetime.datetime.utcfromtimestamp(lastts).strftime('%Y-%m-%dT%H:%M:%S')
        print("Requesting values for %s since %s..." % (station["name"],p["timestart"]))
    try:
        data = []
        sdata = requests.get(IOCSLMSRV, params=p, timeout=TIMEOUT)
        sdata = json.loads(sdata.text)
        for d in sdata:
            dt = datetime.datetime.strptime(d["stime"].strip(),'%Y-%m-%d %H:%M:%S')
            ts = calendar.timegm(dt.utctimetuple())
            v = d["slevel"]
            data.append({"timestamp":ts, "value":str(v)})
        if len(data)>0:
            print("Inserting %d data values for %s..." % (len(data),station["name"]))
            params = {
                "apiver":"2", 
                "inst":INST, 
                "secret":SECRET,
                "station":station["name"],
                "dataformat":"simple",
                "json":json.dumps(data),
                }
            sfeed = requests.post(FEEDURL+"/feedsealevel", data=params, timeout=TIMEOUT).json()
            print("%s: " % station["name"], sfeed)
        else:
            print("%s: No values to insert." % station["name"])
    except Exception as ex:
        print("Error %s: " % station["name"],ex)
    sys.stdout.flush()
    sys.stderr.flush()

def feedmetadata(station):
    print("Updating station %s metadata..." % station["name"])
    params = {
        "apiver":"1", 
        "inst":INST, 
        "secret":SECRET,
        "station":json.dumps(station),
        }
    sfeed = requests.post(FEEDURL+"/feedstation", data=params, timeout=TIMEOUT).json()
    return sfeed.get("status") == "success"

def feedall(station):
    if feedmetadata(station):
        feeddata(station)

if __name__ == "__main__":
    pq = Queue()
    stationlist = requests.get(IOCSLMSRV, params={"query":"stationlist"}, timeout=TIMEOUT).json()
    for s in stationlist:
        stationname = s["Code"]
        if "sensor" in s and s["sensor"] is not None:
            stationname += "_" + s["sensor"]
        station = {}
        station["name"] = stationname
        station["slmcode"] = s["Code"]
        station["lon"] = float(s["Lon"])
        station["lat"] = float(s["Lat"])
        for a in ['Location', 'units', 'type', 'countryname', 'UTCOffset', 'country', 'offset', 'sensor']:
            v = s.get(a,None)
            if v is not None:
                station[a] = v
        pq.put(Process(target=feedall, args=[station]))

    processes = {}
    while (len(processes) > 0) or (not pq.empty()):
        now = int(time.time())
        for t,p in list(processes.items()):
            if now - t > MAXRUNTIME:
                print("Terminating Process.")
                p.terminate()
            if not p.is_alive():
                del processes[t]
        if (not pq.empty()) and len(processes) < PROCESSES:
            p = pq.get()
            p.start()
            processes[now] = p
        time.sleep(.01)

    print("Done.")
