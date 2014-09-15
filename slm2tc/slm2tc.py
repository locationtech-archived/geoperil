#!/usr/bin/env python3
import requests
import os
import sys
import json
import datetime
import calendar
import simplejson
from multiprocessing.pool import ThreadPool

IOCSLMSRV = "http://www.ioc-sealevelmonitoring.org/service.php"
TIMEOUT = 300

configfile = "config.json"
cmd = "retrievedata"
if len(sys.argv) > 1:
    configfile = sys.argv[1]
    if len(sys.argv) > 2:
        cmd = sys.argv[2]


def getdataforstation(args):
    config, s = args
    data = []
    p = {"query":"data", "code":s["slmcode"]}
    if "sensor" in s:
        p["includesensors[]"] = s["sensor"]
    if s["lasttimestamp"] is not None:
        p["timestart"] = datetime.datetime.utcfromtimestamp(s["lasttimestamp"]).strftime('%Y-%m-%dT%H:%M:%S')
    else:
        p["timestart"] = (datetime.datetime.utcnow() - datetime.timedelta(days=7)).strftime('%Y-%m-%dT%H:%M:%S')
    print("Requesting values for %s since %s..." % (s["name"],p["timestart"]))
    sdata = requests.get(IOCSLMSRV, params=p, timeout=TIMEOUT)
    try:
        sdata = json.loads(sdata.text)
        for d in sdata:
            dt = datetime.datetime.strptime(d["stime"].strip(),'%Y-%m-%d %H:%M:%S')
            ts = calendar.timegm(dt.utctimetuple())
            v = d["slevel"]
            data.append({"timestamp":ts, "value":str(v)})
            if s["lasttimestamp"] is None or ts > s["lasttimestamp"]:
                s["lasttimestamp"] = ts
        if len(data)>0:
            print("Inserting %d data values for %s..." % (len(data),s["name"]))
            params = {
                "apiver":"2", 
                "inst":config["inst"], 
                "secret":config["secret"],
                "station":s["name"],
                "dataformat":"simple",
                "json":json.dumps(data),
                }
            sfeed = requests.post(config["feedurl"]+"/feedsealevel", data=params, timeout=TIMEOUT).json()
            print("%s: " % s["name"], sfeed)
        else:
            print("%s: No values to insert." % s["name"])
    except Exception as ex:
        print("Error %s: " % s["name"],ex)
    sys.stdout.flush()
    sys.stderr.flush()


def updatestationmetadata(config):
    n = 0
    for sname,s in config["stations"].items():
        n += 1
        print("Updating station metadata %d/%d: %s..." % (n,len(config["stations"]),s["name"]), end="")
        sdetail = requests.get(IOCSLMSRV, params={"query":"station", "code":s["slmcode"]}, timeout=TIMEOUT).json()
        news = {
            "name":sname, 
            "slmcode":s["slmcode"], 
            "lon":float(sdetail["Lon"]), 
            "lat":float(sdetail["Lat"]),
            }
        if "sensor" in s:
            news["sensor"] = s["sensor"]
        for a in ['Location', 'units', 'type', 'countryname', 'UTCOffset', 'country', 'offset']:
            v = sdetail.get(a,None)
            if v is not None:
                news[a] = v
        params = {
            "apiver":"1", 
            "inst":config["inst"], 
            "secret":config["secret"],
            "station":json.dumps(news),
            }
        sfeed = requests.post(config["feedurl"]+"/feedstation", data=params, timeout=TIMEOUT).json()
        print(sfeed)
        news["lasttimestamp"] = s["lasttimestamp"]
        config["stations"][sname] = news
    print("Updating station metadata done.")


def loadconfig(configfile):
    if os.path.exists(configfile):
        print("Loading configuration file %s." % configfile)
        cf = open(configfile,"r")
        config = json.load(cf)
        cf.close()
        return config
    else:
        print("Configuration file %s does not exist." % configfile)
        sys.exit()


def saveconfig(configfile,config):
    cf = open(configfile,"w")
    json.dump(config, cf, indent=4)
    cf.close()


if cmd=="retrievedata":
    config = loadconfig(configfile)
    stations = []
    for s in config["stations"].values():
        stations.append((config,s))
    tp = ThreadPool(config["threads"])
    tp.map(getdataforstation,stations)
    saveconfig(configfile,config)
elif cmd=="updatemetadata":
    config = loadconfig(configfile)
    updatestationmetadata(config)
    saveconfig(configfile,config)
elif cmd=="updatestations":
    config = loadconfig(configfile)
    
    newstations = []
    oldstations = list(config["stations"].keys())

    stationlist = requests.get(IOCSLMSRV, params={"query":"stationlist"}, timeout=TIMEOUT).json()
    for s in stationlist:
        stationname = s["Code"]
        if "sensor" in s and s["sensor"] is not None:
            stationname += "_" + s["sensor"]
        if stationname in oldstations:
            oldstations.remove(stationname)
        elif stationname in config["stations"]:
            print("Duplicate entry for %s in SLM." % stationname)
        else:
            newstations.append(stationname)
            config["stations"][stationname] = {}
            config["stations"][stationname]["name"] = stationname
            config["stations"][stationname]["lasttimestamp"] = None
        config["stations"][stationname]["slmcode"] = s["Code"]
        config["stations"][stationname]["lon"] = s["Lon"]
        config["stations"][stationname]["lat"] = s["Lat"]
        for a in ['Location', 'units', 'type', 'countryname', 'UTCOffset', 'country', 'offset', 'sensor']:
            v = s.get(a,None)
            if v is not None:
                config["stations"][stationname][a] = v
    if len(newstations)>0:
        print("New stations in SLM (%d):" % len(newstations))
        for s in newstations:
            print("    %s" % s)
    if len(oldstations)>0:
        print("Old stations no longer provided by SLM (%d):" % len(oldstations))
        for s in oldstations:
            print("    %s" % s)
        if len(sys.argv)>3 and sys.argv[3]=="remove":
            for s in oldstations:
                del config["stations"][s]
            print("removed.")
    saveconfig(configfile,config)
elif cmd=="genconfig":
    print("Creating configuration file %s..." % configfile)
    config = {"feedurl":"", "inst":"", "secret":"", "threads":4, "stations":{}}
    stationlist = requests.get(IOCSLMSRV, params={"query":"stationlist"}, timeout=TIMEOUT).json()
    for s in stationlist:
        stationname = s["Code"]
        if "sensor" in s and s["sensor"] is not None:
            stationname += "_" + s["sensor"]
        config["stations"][stationname] = {}
        config["stations"][stationname]["name"] = stationname
        config["stations"][stationname]["slmcode"] = s["Code"]
        config["stations"][stationname]["lon"] = s["Lon"]
        config["stations"][stationname]["lat"] = s["Lat"]
        config["stations"][stationname]["lasttimestamp"] = None
        for a in ['Location', 'units', 'type', 'countryname', 'UTCOffset', 'country', 'offset', 'sensor']:
            v = s.get(a,None)
            if v is not None:
                config["stations"][stationname][a] = v

    saveconfig(configfile,config)
else:
    print("Command %s not known." % cmd)
