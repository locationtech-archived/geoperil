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
        event["time"]=calendar.timegm(time.strptime(e.findtext("{https://www.emsc-csem.org}time"),'%Y-%m-%d %H:%M:%S %Z'))
        event["mag"]=float(e.findtext("{https://www.emsc-csem.org}magnitude").strip().partition(" ")[2])
        event["magtype"]=e.findtext("{https://www.emsc-csem.org}magnitude").strip().partition(" ")[0]
        event["depth"]=float(e.findtext("{https://www.emsc-csem.org}depth").strip().partition(" ")[0])
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
        event["eventid"]=e.get("catalog:eventid","")
        if event["eventid"] == "":
            event["eventid"]=e.get("publicID").partition("=")[2]
        if event["eventid"] == "":
            event["eventid"]=e.get("publicID").rpartition("/")[2].replace(".quakeml","")
        event["eventid"] = idprefix + event["eventid"]
        event["region"]=e.find("{http://quakeml.org/xmlns/bed/1.2}description").findtext("{http://quakeml.org/xmlns/bed/1.2}text")
        o=e.find("{http://quakeml.org/xmlns/bed/1.2}origin")
        event["time"]=calendar.timegm(time.strptime(o.find("{http://quakeml.org/xmlns/bed/1.2}time").findtext("{http://quakeml.org/xmlns/bed/1.2}value").rstrip('Z'),'%Y-%m-%dT%H:%M:%S.%f'))
        event["x"]=float(o.find("{http://quakeml.org/xmlns/bed/1.2}longitude").findtext("{http://quakeml.org/xmlns/bed/1.2}value"))
        event["y"]=float(o.find("{http://quakeml.org/xmlns/bed/1.2}latitude").findtext("{http://quakeml.org/xmlns/bed/1.2}value"))
        event["depth"]=float(o.find("{http://quakeml.org/xmlns/bed/1.2}depth").findtext("{http://quakeml.org/xmlns/bed/1.2}value"))
        mag=e.find("{http://quakeml.org/xmlns/bed/1.2}magnitude")
        event["mag"]=float(mag.find("{http://quakeml.org/xmlns/bed/1.2}mag").findtext("{http://quakeml.org/xmlns/bed/1.2}value"))
        event["magtype"]=mag.findtext("{http://quakeml.org/xmlns/bed/1.2}type")
        events.append(event)
    return events
parsers["quakeml"]=parsequakeml


def feedevent(event):
    url = "http://trideccloud.gfz-potsdam.de/feedersrv/feedhazardevent"
    params = {
        "apiver":"1",
        "inst":"gfz_ex_test",
        "secret":"abcdef",
        "event":json.dumps(event),
    }
    print(requests.post(url, data=params, timeout=60).json())

if __name__=="__main__":
    print("Feed: German Research Centre for Geosciences")
    for e in parsegfz(requests.get("http://geofon.gfz-potsdam.de/eqinfo/list.php?fmt=rss").content):
        e["provider"] = "gfz"
        e["providerurl"] = "http://gfz-potsdam.de"
        e["providername"] = "German Research Centre for Geosciences"
        print("Event ID: {0}".format(e["eventid"]))
        feedevent(e)

    print("Feed: British Geological Survey")
    for e in parsebgs(requests.get("http://www.bgs.ac.uk/feeds/SchoolSeismology.xml").content):
        e["provider"] = "bgs"
        e["providerurl"] = "http://www.bgs.ac.uk/"
        e["providername"] = "British Geological Survey"
        print("Event ID: {0}".format(e["eventid"]))
        feedevent(e)

    print("Feed: Badan Meteorologi, Klimatologi, dan Geofriska")
    for e in parsebmkg(requests.get("http://data.bmkg.go.id/csvlast60event.txt").content):
        e["provider"] = "bmkg"
        e["providerurl"] = "http://www.bmkg.go.id"
        e["providername"] = "Badan Meteorologi, Klimatologi, dan Geofriska"
        print("Event ID: {0}".format(e["eventid"]))
        feedevent(e)

    print("Feed: European Mediterranean Seismological Centre")
    for e in parseesmc(requests.get("http://www.emsc-csem.org/service/rss/rss.php?typ=emsc").content):
        e["provider"] = "esmc"
        e["providerurl"] = "http://www.emsc-csem.org"
        e["providername"] = "European Mediterranean Seismological Centre"
        print("Event ID: {0}".format(e["eventid"]))
        feedevent(e)

    print("Feed: Geoscience Australia")
    for e in parsega(requests.get("http://www.ga.gov.au/earthquakes/all_recent.rss").content):
        e["provider"] = "ga"
        e["providerurl"] = "http://www.ga.gov.au"
        e["providername"] = "Geoscience Australia"
        print("Event ID: {0}".format(e["eventid"]))
        feedevent(e)

    print("Feed: Global Disaster Alert and Coordination System")
    for e in parsegdacs(requests.get("http://www.gdacs.org/rss.aspx").content):
        e["provider"] = "gdacs"
        e["providerurl"] = "http://www.gdacs.org"
        e["providername"] = "Global Disaster Alert and Coordination System"
        print("Event ID: {0}".format(e["eventid"]))
        feedevent(e)

    print("Feed: GeoNet")
    for e in parsegns(requests.get("http://www.geonet.org.nz/quakes/services/all.rss").content):
        e["provider"] = "gns"
        e["providerurl"] = "http://www.geonet.org.nz"
        e["providername"] = "GeoNet"
        print("Event ID: {0}".format(e["eventid"]))
        feedevent(e)

    print("Feed: Portuguese Sea and Atmosphere Institute")
    for e in parseipma(requests.get("http://www.ipma.pt/resources.www/rss/sism_geral.xml").content):
        e["provider"] = "ipma"
        e["providerurl"] = "http://www.ipma.pt"
        e["providername"] = "Portuguese Sea and Atmosphere Institute"
        print("Event ID: {0}".format(e["eventid"]))
        feedevent(e)

    print("Feed: Kandilli Observatory and Earthquake Research Institute")
    for e in parsekoeri(requests.get("http://sc3.koeri.boun.edu.tr/eqevents/eq_events?sort=Origin+Time+UTC&desc=descending&get_events=true&get_rss=Get+RSS").content):
        e["provider"] = "koeri"
        e["providerurl"] = "http://www.koeri.boun.edu.tr"
        e["providername"] = "Kandilli Observatory and Earthquake Research Institute"
        print("Event ID: {0}".format(e["eventid"]))
        feedevent(e)

    print("Feed: National Observatory of Athens")
    for e in parsenoa(requests.get("http://bbnet.gein.noa.gr/rss/automatic_events_24h.xml").content):
        e["provider"] = "noa"
        e["providerurl"] = "http://bbnet.gein.noa.gr/HL/"
        e["providername"] = "National Observatory of Athens"
        print("Event ID: {0}".format(e["eventid"]))
        feedevent(e)

    print("Feed: Natural Resources Canada")
    for e in parsenrc(requests.get("http://www.earthquakescanada.nrcan.gc.ca/index-eng.php?tpl_region=canada&tpl_output=rss").content):
        e["provider"] = "nrc"
        e["providerurl"] = "http://www.earthquakescanada.nrcan.gc.ca"
        e["providername"] = "Natural Resources Canada"
        print("Event ID: {0}".format(e["eventid"]))
        feedevent(e)

    print("Feed: United States Geological Survey")
    for e in parsequakeml(requests.get("http://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.quakeml").content,"USGS-"):
        if "depth" in e:
            e["depth"] = e["depth"] / 1000
        e["provider"] = "usgs"
        e["providerurl"] = "http://www.usgs.gov"
        e["providername"] = "United States Geological Survey"
        print("Event ID: {0}".format(e["eventid"]))
        feedevent(e)

    print("Feed: Incorporated Research Institutions for Seismology")
    for e in parsequakeml(requests.get("http://service.iris.edu/fdsnws/event/1/query?starttime={date}".format(date=(datetime.datetime.utcnow()-datetime.timedelta(days=1)).strftime('%Y-%m-%d'))).content,"IRIS-"):
        if "depth" in e:
            e["depth"] = e["depth"] / 1000
        e["provider"] = "iris"
        e["providerurl"] = "http://www.iris.edu"
        e["providername"] = "Incorporated Research Institutions for Seismology"
        print("Event ID: {0}".format(e["eventid"]))
        feedevent(e)
