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

import requests
import sys
import json
import simplejson
import datetime
import time
import calendar
import threading
import socket
import subprocess
import os
from uuid import UUID, uuid4
from multiprocessing import Process
from queue import Queue
import configparser
import hashlib

TCURL = "http://trideccloud.gfz-potsdam.de/nodes/tcnode1/workersrv"
INST = "gfz"
SECRET = "abcdef"

def hashfile(filename):
    h = hashlib.new("sha256")
    f = open(filename, "rb")
    buf = f.read(4096)
    while len(buf)>0:
        h.update(buf)
        buf = f.read(4096)
    f.close()
    return h.hexdigest()



class EasywaveWorker():
    def __init__(self,config,wid=None):
        self.sims = [
            "easywave"
        ]
        self.config = config
        self.wid = wid
        if self.wid is not None and self.wid not in self.config.sections():
            self.config[self.wid] = {}

    def register(self,tcurl,inst,secret,priority=0):
        self.wid = self.wid if self.wid else str(uuid4())
        name = socket.gethostname()
        payload = {
            "inst":inst,
            "secret":secret,
            "workerid":self.wid,
            "name":name,
            "priority":str(priority),
            "providedsims":" ".join(self.sims),
        }
        r = requests.post(tcurl+"/register",data=payload)
        if r.json().get("status",None) != "success":
            print(r.json().get("status","error"))
            return None
        if self.wid not in self.config.sections():
            self.config[self.wid] = {}
        self.config[self.wid]["tcurl"] = tcurl
        self.config[self.wid]["class"] = self.__class__.__name__
        return self.wid

    def saveconfig(self,configfile):
        with open(configfile,"w") as cf:
            self.config.write(cf)

    def tcurl(self):
        return self.config[self.wid].get("tcurl")

    def waitforwork(self):
        r = requests.post(self.tcurl()+"/waitforwork", data={"workerid":self.wid}, stream=True)
        for l in r.iter_lines(chunk_size=1,decode_unicode=True):
            if l.strip() != "":
                try:
                    return json.loads(l).get("taskid",None)
                except Exception:
                    pass

    def setstate(self,state,progress=None,task=None):
        r = requests.post(self.tcurl()+"/setstate", data={"workerid":self.wid,"state":state,"progress":progress,"task":task})
        return r.json().get("status",None) == "success"

    def gettask(self,tid):
        if tid is not None:
            r = requests.post(self.tcurl()+"/gettask", data={"workerid":self.wid,"taskid":tid})
            if r.json().get("status",None) != "success":
                print(r.json().get("status","error"))
                return None
            return r.json()

    def updateenv(self):
        print("Updating Simulation Environment...")
        r = requests.post(self.tcurl()+"/getenv", data={"workerid":self.wid})
        for f in r.json().get("env",[]):
            os.makedirs(f["kind"],exist_ok=True)
            fname = os.path.join(f["kind"],f["name"])
            if not os.path.exists(fname) or hashfile(fname) != f["hash"]:
                params = {"workerid":self.wid,"kind":f["kind"],"name":f["name"]}
                r = requests.post(self.tcurl()+"/getenvfile", data=params, stream=True)
                if r.status_code == 200:
                    print("Downloading %s..." % fname)
                    f = open(fname,"wb")
                    for buf in r.iter_content(chunk_size=4096):
                        f.write(buf)
                    f.close()
                else:
                    print("%d: %s" % (r.status_code,r.reason))
        print("done.")

    def writefault(self,faultfile,faultdata):
        if set(faultdata.keys()).issuperset(set(["mw","lon","lat","depth","strike","sip","rake"])):
            f = open(faultfile,"wt")
            f.write("-mw {mw} -location {lon} {lat} {depth} -strike {strike} -dip {dip} -rake {rake}\n".format(**faultdata))
            f.close()
            return True

    def writepois(self,poifile,poidata):
        f = open(poifile,"wt")
        nr = 0
        for poi in poidata:
            if set(poi.keys()).issuperset(set(["id","lon","lat"])):
                f.write("{id}\t{lon}\t{lat}\n")
                nr += 1
        f.close()
        return nr

    def runeasywave(self,ewbinary,workdir,gridfile,faultfile,poifile,simtime):
        args = [
            ewbinary,
            "-grid", gridfile,
            "-poi", poifile,
            "-poi_dt_out", "30",
            "-source", faultfile,
            "-propagation", "10",
            "-step", "1",
            "-ssh_arrival", "0.001",
            "-time", simtime,
            "-verbose",
            "-adjust_ztop",
            "-gpu"
        ]
        p = subprocess.Popen(args,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,cwd=workdir)
        return p

    def prepareworkdir(self,task):
        cwd = os.getcwd()
        task["workdir"] = os.path.join(cwd,"tasks",os.path.basename(task["taskid"]))
        if os.path.exists(task["workdir"]):
            print("%s already exists.")
            return False
        os.makedirs(task["workdir"])
        task["gridfile"] = os.path.join(cwd,"grids",os.path.basename(task["grid"]))
        task["faultfile"] = os.path.join(task["workdir"],"fault.inp")
        task["poifile"] = os.path.join(task["workdir"],"pois.inp")
        if not writefault(task["faultfile"],task["fault"]):
            print("fault data is missing.")
            return False
        if writepois(task["poifile"],task["pois"]) != len(task["pois"]):
            print("some poi data is missing.")
        return True

    def runtask(self,task):
        if self.prepareworkdir(task):
            p = self.runeasywave(
                os.path.join(os.getcwd(),"bin",task["binary"]),
                task["workdir"],
                task["gridfile"],
                task["faultfile"],
                task["poifile"],
                task["simtime"],
            )

def usage():
    print("Usage:")
    print("    %s <config> register <url> <inst> <secret> [<priority>]" % sys.argv[0])
    print("    %s <config> update" % sys.argv[0])

if __name__ == "__main__":
    if len(sys.argv) > 2:
        config = configparser.ConfigParser()
        config.read(sys.argv[1])
        if sys.argv[2] == "register" and len(sys.argv) > 5:
            worker = EasywaveWorker(config)
            worker.register(sys.argv[3],sys.argv[4],sys.argv[5],sys.argv[6] if len(sys.argv) > 6 else 0)
            worker.saveconfig(sys.argv[1])
        elif sys.argv[2] == "update":
            for wid in config.sections():
                if "class" in config[wid]:
                    worker = globals()[config[wid]["class"]](config,wid)
                    worker.updateenv()
                else:
                    print("Class missing for Worker %s." % wid)

        else:
            usage()
    else:
        usage()

