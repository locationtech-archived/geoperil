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
import re
import time
import datetime
import urllib.request, urllib.parse, urllib.error
import urllib.request, urllib.error, urllib.parse
import atexit
import json

from pymongo import MongoReplicaSetClient

class LatLon:
    def __init__(self, lat, lon):
        self.lat = lat
        self.lon = lon

def isPointInsidePoylgon( regions_file, t ):
    
    kml_regions = open( regions_file, 'r')
    
    txt = kml_regions.read()

    regions = re.findall( '<Placemark .*?>(.*?)</Placemark>', txt, re.S )
    names = re.findall( '<span class="atr-name">NAME</span>:</strong> <span class="atr-value">(.*?)</span>', txt, re.S )
        
    areas = []
    
    for region in regions:
      
        polygons = []
      
        matches = re.findall( '<outerBoundaryIs>.*?<coordinates>(.*?)</coordinates>', region, re.S )
      
        for m in matches:
          
            arr = m.split(' ')
            obj = []
        
            for i in arr:
                coord = i.split(',')
                obj.append( LatLon( float(coord[1]), float(coord[0]) ) )
            
            polygons.append( obj )
            
        areas.append( polygons )
            
    # now start algorithm and check if the point lies inside one polygon
    nr = 0
    
    for area in areas:
    
        for p in area:
        
            inside = 0
            
            j = len(p) - 1
            for i in range( 0, len(p) ):
              
                if p[i].lat < t.lat and p[j].lat >= t.lat or p[i].lat >= t.lat and p[j].lat < t.lat :
            
                    if p[i].lon + (t.lat - p[i].lat) / ( p[j].lat - p[i].lat ) * ( p[j].lon - p[i].lon ) < t.lon :
                        inside = (inside + 1) % 2
              
                j = i
              
            if inside:
                return names[nr]            
        
        nr += 1
    
    return None

# this is now still left in the manager to unburden the Tomcat server
# however we could move this into the server as well
def getType( db, inst, entry ):
        
    ret = db['eqs'].find( { "id": entry["id"] } )
    
    if ret.count() == 0:
        
        # no entry with same id found --> new entry
        iho_region = isPointInsidePoylgon( "World_Seas.kml", LatLon( entry["lat"], entry["lon"] ) )
        if iho_region != None:
            entry["sea_area"] = iho_region
        
        return "new"
    
    # convert iso date string of form YYYY-MM-DDTHH:MM:SS.mmmZ to datetime
    date = datetime.datetime.strptime( entry["date"], "%Y-%m-%dT%H:%M:%S.%fZ" )

    query = { "prop.region": entry["name"],
              "prop.latitude": entry["lat"],
              "prop.longitude": entry["lon"],
              "prop.magnitude": entry["mag"],
              "prop.depth": entry["depth"],
              "prop.date": date,
            }
        
    if "dip" in entry:
        query["prop.dip"] = entry["dip"]
        
    if "strike" in entry:
        query["prop.strike"] = entry["strike"]
    
    if "rake" in entry:
        query["prop.rake"] = entry["rake"]
    
    query.update( { "id": entry['id'],
                    "user": inst["_id"],
                  })
    
    # check if IHO region was set already in one of the related entries returned in ret
    for r in ret:
        
        if r["prop"]["latitude"] == entry["lat"] and \
           r["prop"]["longitude"] == entry["lon"]:
            
            if "sea_area" in r["prop"] and r["prop"]["sea_area"]:
                entry["sea_area"] = r["prop"]["sea_area"]
                break
                        
    # check for update
    ret = db['eqs'].find( query )
    
    if ret.count() == 0:
        
        # no matching entry for all properties found --> update
        if "sea_area" not in entry:
            iho_region = isPointInsidePoylgon( "World_Seas.kml", LatLon( entry["lat"], entry["lon"] ) )
            if iho_region != None:
                entry["sea_area"] = iho_region
        
        return "update"
       
    # entry exists already
    return "existing"
        
def read_mt( entry, mt ):

    s = """(\d\d/\d\d/\d\d) (\d\d:\d\d:\d\d.\d\d)
(.*?)
Epicenter: (.*?) (.*?)
MW (.*?)

GFZ MOMENT TENSOR SOLUTION
Depth ([ \d]{1,3}) .*?
(?:.*?\n){8}
Best Double Couple:.*?
 NP1:Strike=([ \d]{1,3}) Dip=([ \d]{1,2}) Slip=([- \d]{1,4})
"""

    response = urllib.request.urlopen( 'http://geofon.gfz-potsdam.de' + mt )
    data = response.read()
    txt = data.decode('utf-8')

    prop = re.findall( s, txt )

    if len(prop) == 0:
      return 1

    prop = prop[0]

    date = datetime.datetime.strptime( prop[0] + " " + prop[1], "%y/%m/%d %H:%M:%S.%f")

    # adjust to right format if milliseconds are missing
    datestr = date.isoformat();
    if not '.' in datestr:
        datestr = datestr + ".000000";

    datestr = datestr[:-3] + 'Z'; #ISO time format YYYY-MM-DDTHH:MM:SS.mmmZ

    entry["name"] = prop[2]
    entry["lat"] = float(prop[3])
    entry["lon"] = float(prop[4])
    entry["mag"] = float(prop[5])
    entry["depth"] = float(prop[6])
    entry["strike"] = float(prop[7])
    entry["dip"] = float(prop[8])
    entry["rake"] = float(prop[9])
    entry["date"] = datestr

    return 0
        
def main():
        
    startTime = time.time()
    
    url = 'http://geofon.gfz-potsdam.de/eqinfo/list.php?page='
    page = 1
       
    cntTotal = 0
    cntInsert = 0
    cntUpdate = 0
    cntError = 0
    cntSim = 0
    cntKnown = 0
        
    client = MongoReplicaSetClient("mongodb://tcnode1,tcnode2,tcnode3/?replicaSet=tcmongors0" ,w="majority",
        socketTimeoutMS=10000,connectTimeoutMS=10000)
    db = client['trideccloud']
    
    inst = db['institutions'].find( { "name": "gfz" } )[0]
        
    elist = []
    
    # stop if we have seen at least 100 known entries (rounded up to a multiple of page size) --> updates for older entries are unlikely
    while cntKnown < 100:
    
        response = urllib.request.urlopen( url + str(page) )
        data = response.read()
        text = data.decode('utf-8')
                
        pattern = ("<tr.*?>.*?"
         "<td.*?><a.*?(gfz\d\d\d\d\w\w\w\w)'>(.*?)</a></td>.*?" # eventId, date
         "<td.*?>(.*?)</td>.*?" # magnitude
         "<td.*?>(.*?)</td>.*?" # latitude
         "<td.*?>(.*?)</td>.*?" # longitude
         "<td.*?>(.*?)</td>.*?" # depth
         "<td.*?>.*?</td>.*?" # status
         "<td.*?>(?:<a href='(.*?)'>MT</a>)?</td>.*?" # link to mt.txt
         "<td.*?>(.*?)</td>.*?" # region
         "</tr>"
        )
        
        matches = re.findall( pattern, text, re.MULTILINE | re.DOTALL )
        
        #if page == 5:
        #    break
        
        if len( matches ) == 0:
            break
            
        page += 1
        
        for m in matches:

            #print(m)

            cntTotal += 1
            
            entry = {
              "inst": inst["name"],
              "secret": inst["secret"],
              "id": m[0],
            }
            
            ret = 0
            
            # parse mt.txt if moment tensor is available
            mt = m[6]
            if mt != '':
                ret = read_mt( entry, mt )
            else:
                date = datetime.datetime.strptime( m[1], "%Y-%m-%d %H:%M:%S")
                entry["date"] = date.isoformat() + '.000Z' #ISO time format YYYY-MM-DDTHH:MM:SS.mmmZ
                entry["name"] = m[7]
                entry["lat"] = float(m[3][:-6]) * (1 - 2*m[3].endswith("S"))
                entry["lon"] = float(m[4][:-6]) * (1 - 2*m[4].endswith("W"))
                entry["mag"] = float(m[2])
                entry["depth"] = float(m[5])
            if ret != 0:
                print('Error: ', entry["id"])
                cntError += 1
                continue
            
            print( "Fetch: ", entry["date"], entry["id"] )
                                            
            # get type of entry and set IHO region
            type = getType( db, inst, entry )
                                                    
            if type == "new" or type == "update":
                
                elist.append( { "type": type, "entry": entry } )
                                
            else:
                cntKnown += 1

    print('\n')

    for elem in reversed( elist ):
                
        type = elem["type"]
        entry = elem["entry"]
                
        if type == "new":
            cntInsert += 1            
        elif type == "update":
            cntUpdate += 1
                
        if "sea_area" in entry and entry["mag"] > 5.5 and entry["depth"] < 100:
            cntSim += 1
            entry.update( { "comp": 180 } )
          
        data = urllib.parse.urlencode( entry ).encode('ascii')
        req = urllib.request.Request('http://trideccloud.gfz-potsdam.de/srv/data_insert', data)
        res = urllib.request.urlopen( req ).read()
                                                               
        time.sleep( 0.01 )
                            
    print('Total: %u' % cntTotal)
    print('Inserted: %u' % cntInsert)
    print('Updated: %u' % cntUpdate)
    print('Errors: %u' % cntError)
    print('Pages: %u' % page)
    print('Simulated: %u' % cntSim)
    
    client.close()
    endTime = time.time()
    
    print("Duration: %u" % (endTime - startTime))
    
    
if __name__ == "__main__":
        
    main()
