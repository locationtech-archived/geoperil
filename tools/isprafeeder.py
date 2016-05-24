#!/usr/bin/env python3

import requests
import time
import datetime
import calendar
import re
import json
from xml.etree.ElementTree import *

regexalnum='([0-9\.]+)([A-Za-z]+)'

parsers={}
def parsegfz(data,idprefix=None):
    events=[]
    xml=fromstring(data)
    for e in xml.iter("item"):
        event={"eventtype":"EQ"}
        event["eventid"]=e.findtext("guid")
        event["url"]=e.findtext("link")
        title=e.findtext("title").split(",")
        desc=e.findtext("description").split()
        if len(title)>=2 and len(desc)>=5:
            event["mag"]=float(title[0].partition(' ')[2])
            event["magtype"]=title[0].partition(' ')[0]
            event["region"]=title[1].strip()
            event["time"]=calendar.timegm(time.strptime(desc[0]+" "+desc[1],'%Y-%m-%d %H:%M:%S'))
            event["y"]=float(desc[2])
            event["x"]=float(desc[3])
            event["depth"]=float(desc[4])
            events.append(event)
    return events
parsers["gfz"]=parsegfz

def parsebgs(data,idprefix="BGS-"):
    events=[]
    xml=fromstring(data)
    for e in xml.iter("item"):
        event={"eventtype":"EQ"}
        event["x"]=float(e.findtext("{http://www.w3.org/2003/01/geo/wgs84_pos#}long"))
        event["y"]=float(e.findtext("{http://www.w3.org/2003/01/geo/wgs84_pos#}lat"))
        event["eventid"]=idprefix+e.findtext("link").partition("quake_id=")[2]
        event["url"]=e.findtext("link")
        desc=e.findtext("description").split(" : ")
        if len(desc)>=4:
            event["time"]=calendar.timegm(time.strptime(desc[0].partition(",")[2].strip(),'%d %b %Y %H:%M:%S %Z'))
            event["mag"]=float(re.sub(regexalnum,'\\1',desc[1].partition(' ')[2].strip()))
            event["magtype"]=re.sub(regexalnum,'\\2',desc[1].partition(' ')[2].strip())
            event["depth"]=float(re.sub(regexalnum,'\\1',desc[2].partition(' ')[2].strip()))
            event["region"]=desc[3].partition(" ")[2].strip()
            events.append(event)
    return events
parsers["bgs"]=parsebgs

def parsebmkg(data,idprefix="BMKG-"):
    events=[]
    if type(data)==bytes:
        data=data.decode('UTF-8')
    data=data.strip().partition("\n")[2]
    for line in data.split("\n"):
        line=line.split(",")
        event={"eventtype":"EQ","magtype":"M"}
        event["x"]=float(line[4])
        event["y"]=float(line[3])
        event["eventid"]=idprefix+line[1]
        event["time"]=calendar.timegm(time.strptime(" ".join(line[2].split(" ")[1:3]),'%d-%m-%Y %H:%M:%S'))-7*60*60
        event["mag"]=float(line[5])
        event["depth"]=float(line[6])
        event["region"]=line[7]
        events.append(event)
    return events
parsers["bmkg"]=parsebmkg

def parseesmc(data,idprefix="ESMC-"):
    events=[]
    xml=fromstring(data)
    for e in xml.iter("item"):
        event={"eventtype":"EQ"}
        event["x"]=float(e.findtext("{http://www.w3.org/2003/01/geo/}long"))
        event["y"]=float(e.findtext("{http://www.w3.org/2003/01/geo/}lat"))
        event["eventid"]=idprefix+e.findtext("guid").rpartition("id=")[2]
        event["url"]=e.findtext("link")
        event["time"]=calendar.timegm(time.strptime(e.findtext("{http://www.emsc-csem.org}time"),'%Y-%m-%d %H:%M:%S %Z'))
        event["mag"]=float(e.findtext("{http://www.emsc-csem.org}magnitude").partition(" ")[2])
        event["magtype"]=e.findtext("{http://www.emsc-csem.org}magnitude").partition(" ")[0]
        event["depth"]=float(e.findtext("{http://www.emsc-csem.org}depth").partition(" ")[0])
        event["region"]=e.findtext("title").strip()
        events.append(event)
    return events
parsers["esmc"]=parseesmc

def parsega(data,idprefix="GA-"):
    events=[]
    xml=fromstring(data)
    for e in xml.iter("item"):
        event={"eventtype":"EQ","magtype":"M"}
        point=e.findtext("{http://www.georss.org/georss}point").split()
        event["eventid"]=idprefix+e.findtext("link").partition("quakeId=")[2].partition("&")[0]
        event["url"]=e.findtext("link")
        title=e.findtext("title").split(",")
        desc=e.findtext("description").split("<br>")
        if len(point)==2 and len(title)>=2 and len(desc)>=4:
            event["x"]=float(point[1])
            event["y"]=float(point[0])
            event["mag"]=float(title[0].replace("Magnitude","").strip())
            event["region"]=title[1].strip()
            event["time"]=calendar.timegm(time.strptime(desc[1].strip(),'UTC: %d %B %Y %H:%M:%S  (%Z)'))
            event["depth"]=float(desc[3].rpartition(":")[2].strip())
        events.append(event)
    return events
parsers["ga"]=parsega

def parsegdacs(data,idprefix="GDACS-"):
    events=[]
    xml=fromstring(data)
    for e in xml.iter("item"):
        event={}
        event["eventid"]=idprefix+e.findtext("guid")
        event["url"]=e.findtext("link")
        event["time"]=calendar.timegm(time.strptime(e.findtext("pubDate"),'%a, %d %b %Y %H:%M:%S %Z'))
        event["region"]=e.findtext("{http://www.gdacs.org}country")
        point=e.findtext("{http://www.georss.org/georss}point").split()
        event["eventtype"]=e.findtext('{http://www.gdacs.org}eventtype')
        desc=e.findtext('{http://www.gdacs.org}severity')
        desc=desc.translate(desc.maketrans(",:","  ")).split()
        if len(point)==2:
            event["x"]=float(point[1])
            event["y"]=float(point[0])
            if event["eventtype"]=="EQ" and len(desc)>=4 and desc[1].endswith("M") and desc[3].endswith("km"):
                event["mag"]=float(re.sub(regexalnum,'\\1',desc[1]))
                event["magtype"]=re.sub(regexalnum,'\\2',desc[1])
                event["depth"]=float(desc[3].rstrip("km"))
            elif event["eventtype"]=="TC" and "km/h" in (" ".join(desc)):
                event["speed"]=float((" ".join(desc)).partition("km/h")[0].strip().rpartition(" ")[2])
            elif event["eventtype"]=="FL" and len(desc)>=2:
                event["mag"]=float(desc[1])
                event["magtype"]="M"
            else:
                event["severity"]=" ".join(desc)
                #print(tostring(e))
            events.append(event)
    return events
parsers["gdacs"]=parsegdacs

def parsegns(data,idprefix="GNS-"):
    regextime="<td><b>Universal Time</b></td><td>([A-Za-z]+ [0-9]+ [0-9]+, [0-9]+:[0-9]+:[0-9]+)</td></tr>"
    regexdepth="<td><b>Focal Depth</b></td><td>([0-9]+) km</td></tr>"
    regexmag="<td><b>Magnitude</b></td><td>([0-9\.]+)</td></tr>"
    regexregion="<td><b>Location</b></td><td>(.*)</td></tr>"
    events=[]
    xml=fromstring(data)
    for e in xml.iter("item"):
        event={"eventtype":"EQ","magtype":"M"}
        event["x"]=float(e.findtext("{http://www.w3.org/2003/01/geo/wgs84_pos#}long"))
        event["y"]=float(e.findtext("{http://www.w3.org/2003/01/geo/wgs84_pos#}lat"))
        event["eventid"]=idprefix+e.findtext("guid").rpartition("/")[2]
        event["url"]=e.findtext("link")
        desc=e.findtext("{http://purl.org/rss/1.0/modules/content/}encoded").split("<tr>")
        if len(desc)>=8 and re.match(regextime,  desc[2]) \
                        and re.match(regexdepth, desc[5]) \
                        and re.match(regexmag, desc[6]) \
                        and re.match(regexregion, desc[7]) :
            event["time"]=calendar.timegm(time.strptime(re.sub(regextime,'\\1',desc[2]),'%B %d %Y, %H:%M:%S'))
            event["depth"]=float(re.sub(regexdepth,'\\1',desc[5]))
            event["mag"]=float(re.sub(regexmag,'\\1',desc[6]))
            event["region"]=re.sub(regexregion,'\\1',desc[7])
            events.append(event)
    return events
parsers["gns"]=parsegns

def parseipma(data,idprefix="IPMA-"):
    events=[]
    xml=fromstring(data)
    for e in xml.iter("spot"):
        event={"eventtype":"EQ"}
        event["x"]=float(e.get("lon"))
        event["y"]=float(e.get("lat"))
        event["time"]=calendar.timegm(time.strptime(e.get("time"),'%Y-%m-%dT%H:%M:%S'))
        event["eventid"]=idprefix+e.findtext("source")+str(event["time"])
        event["depth"]=float(e.findtext("depth"))
        event["mag"]=float(e.findtext("magnitud"))
        event["magtype"]="M"+e.findtext("magType")
        event["region"]=e.findtext("obsRegion")
        events.append(event)
    return events
parsers["ipma"]=parseipma

def parsekoeri(data,idprefix=None):
    events=[]
    #print(data)
    xml=fromstring(data)
    for e in xml.iter("item"):
        event={"eventtype":"EQ","magtype":"M"}
        event["eventid"]=e.findtext("link").split("/")[-2]
        event["url"]=e.findtext("link")
        title=e.findtext("title").split(",")
        desc=e.findtext("description").split()
        if len(title)>=2 and len(desc)>=5:
            event["mag"]=float(title[0].strip())
            event["region"]=title[1].strip()
            event["time"]=calendar.timegm(time.strptime(desc[0]+" "+desc[1],'%Y/%m/%d %H:%M:%S'))
            event["y"]=float(desc[2])
            event["x"]=float(desc[3])
            event["depth"]=float(desc[4])
            events.append(event)
    return events
parsers["koeri"]=parsekoeri

def parsenoa(data,idprefix="NOA-"):
    events=[]
    xml=fromstring(data)
    for e in xml.iter("item"):
        event={"eventtype":"EQ"}
        event["x"]=float(e.findtext("{http://www.w3.org/2003/01/geo/}long"))
        event["y"]=float(e.findtext("{http://www.w3.org/2003/01/geo/}lat"))
        event["time"]=calendar.timegm(time.strptime(e.findtext("pubDate"),'%d/%m/%Y %H:%M:%S'))
        event["eventid"]=idprefix+e.findtext("ID")
        event["url"]=e.findtext("link")
        event["depth"]=float(re.sub("[^0-9\.]","",e.findtext("eqDepth")))
        mag=e.findtext("mag").strip().partition(" ")
        event["mag"]=float(mag[0])
        event["magtype"]=mag[2]
        event["region"]=e.findtext("title").partition(",")[2].strip()
        events.append(event)
    return events
parsers["noa"]=parsenoa

def parsenrc(data,idprefix="NRC-"):
    events=[]
    xml=fromstring(data)
    for e in xml.iter("item"):
        event={"eventtype":"EQ"}
        event["time"]=calendar.timegm(time.strptime(e.findtext("pubDate"),'%a, %d %b %Y %H:%M:%S %Z'))
        event["eventid"]=idprefix+e.findtext("guid").split("/")[-2]
        event["url"]=e.findtext("link")
        event["depth"]=None
        if e.find("{http://www.georss.org/georss}where") is not None:
            point=e.find("{http://www.georss.org/georss}where").find("{http://www.opengis.net/gml}Point").findtext("{http://www.opengis.net/gml}pos").split()
            title=e.findtext("title").partition(":")[2].partition(" - ")
            if len(point)>=2:
                event["x"]=float(point[1])
                event["y"]=float(point[0])
                event["mag"]=float(title[0].partition("=")[2].strip())
                event["magtype"]=title[0].partition("=")[0].strip()
                event["region"]=title[2].strip()
                events.append(event)
    return events
parsers["nrc"]=parsenrc

def parseusgs(data,idprefix=None):
    events=[]
    xml=fromstring(data)
    for e in xml.iter("{http://www.w3.org/2005/Atom}entry"):
        event={"eventtype":"EQ"}
        event["time"]=calendar.timegm(time.strptime(e.findtext("{http://purl.org/dc/elements/1.1/}date"),'%Y-%m-%dT%H:%M:%SZ'))
        event["eventid"]=e.findtext("{http://www.w3.org/2005/Atom}id")
        event["url"]=e.find("{http://www.w3.org/2005/Atom}link").get("href")
        event["depth"]=float(e.findtext("{http://www.georss.org/georss}elev"))
        point=e.findtext("{http://www.georss.org/georss}point").split()
        title=e.findtext("{http://www.w3.org/2005/Atom}title").partition(",")
        if len(point)>=2:
            event["x"]=float(point[1])
            event["y"]=float(point[0])
            event["mag"]=float(title[0].partition(" ")[2].strip())
            event["magtype"]=title[0].partition(" ")[0].strip()
            event["region"]=title[2].strip()
            events.append(event)
    return events
parsers["usgs"]=parseusgs

def parsequakeml(data,idprefix=""):
    events=[]
    xml=fromstring(data)
    for e in xml.iter("{http://quakeml.org/xmlns/bed/1.2}event"):
        event={"eventtype":"EQ"}
        event["eventid"]=idprefix+e.get("publicID").partition("=")[2]
        event["region"]=e.find("{http://quakeml.org/xmlns/bed/1.2}description").findtext("{http://quakeml.org/xmlns/bed/1.2}text")
        o=e.find("{http://quakeml.org/xmlns/bed/1.2}origin")
        event["time"]=calendar.timegm(time.strptime(o.find("{http://quakeml.org/xmlns/bed/1.2}time").findtext("{http://quakeml.org/xmlns/bed/1.2}value"),'%Y-%m-%dT%H:%M:%S.%f'))
        event["x"]=float(o.find("{http://quakeml.org/xmlns/bed/1.2}longitude").findtext("{http://quakeml.org/xmlns/bed/1.2}value"))
        event["y"]=float(o.find("{http://quakeml.org/xmlns/bed/1.2}latitude").findtext("{http://quakeml.org/xmlns/bed/1.2}value"))
        event["depth"]=float(o.find("{http://quakeml.org/xmlns/bed/1.2}depth").findtext("{http://quakeml.org/xmlns/bed/1.2}value"))
        mag=e.find("{http://quakeml.org/xmlns/bed/1.2}magnitude")
        event["mag"]=float(mag.find("{http://quakeml.org/xmlns/bed/1.2}mag").findtext("{http://quakeml.org/xmlns/bed/1.2}value"))
        event["magtype"]=mag.findtext("{http://quakeml.org/xmlns/bed/1.2}type")
        events.append(event)
    return events
parsers["quakeml"]=parsequakeml

def parseispra(data,idprefix=""):
    events=[]
    xml=fromstring(data)
    for e in xml.iter("item"):
        event={"eventtype":"EQ"}
        event["time"]=calendar.timegm(time.strptime(e.findtext("pubDate"),'%a, %d %b %Y %H:%M:%S %Z'))
        event["eventid"]=idprefix+e.findtext("guid")
        event["url"]=e.findtext("link")
        try:
            event["strike"] = float(e.findtext("strike"))
            event["dip"] = float(e.findtext("dip"))
            event["rake"] = float(e.findtext("rake"))
        except:
            pass
        title=e.findtext("title").partition(",")
        event["mag"]=float(title[0].partition(" ")[2].strip())
        event["x"]=float(e.findtext("{http://www.w3.org/2003/01/geo/wgs84_pos#}long"))
        event["y"]=float(e.findtext("{http://www.w3.org/2003/01/geo/wgs84_pos#}lat"))
        event["magtype"]=title[0].partition(" ")[0].strip()
        event["region"]=title[2].strip()
        for subj in e.iter("{http://purl.org/dc/elements/1.1/}subject"):
            if subj.text.endswith(" km"):
                event["depth"]=float(subj.text.partition(" ")[0])
        events.append(event)
    return events
parsers["ispra"]=parseispra



def feedevent(event):
    url = "http://trideccloud.gfz-potsdam.de/srv/data_insert"
    params = {
        "inst":"tdss15",
        "secret":"TDSS2015",
        "id":event["eventid"],
        "name":event["region"],
        "sea_area":event["region"],
        "comp":"180",
        "lon":event["x"],
        "lat":event["y"],
        "mag":event["mag"],
        "depth":event["depth"],
        "date":time.strftime("%Y-%m-%dT%H:%M:%S.00Z",time.gmtime(event["time"])),
#        "date":time.strftime("%Y-%m-%dT%H:%M:%S.00Z",time.gmtime(time.time()-30)),
    }
    s = []
    for k,v in params.items():
        s.append("%s=%s" % (k,v))
    print("curl --data \"%s\" %s" % ("&".join(s), url))
    print(requests.post(url, data=params, timeout=60).json())

if __name__=="__main__":
    try:
        f = open("lastevents.txt","rt")
        lastevents = f.read().strip().split("\n")
        f.close()
    except:
        lastevents = []
#    for e in parseispra(requests.get("http://trideccloud.gfz-potsdam.de/TRIDEC.xml").content):
    for e in parseispra(requests.get("http://webcritech.jrc.ec.europa.eu/tdss/TRIDEC.xml").content):
        e["provider"] = "ispra"
        if e["eventid"] not in lastevents:
            feedevent(e)
            lastevents.append(e["eventid"])
    f = open("lastevents.txt","wt")
    for eid in lastevents:
        f.write("%s\n" % eid)
    f.close()

