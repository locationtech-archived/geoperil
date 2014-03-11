#!/usr/bin/python

import os
import sys
import re
import time
import datetime
import urllib
import urllib2
import atexit

from pymongo import MongoClient

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

def cleanup( pidfile ):
    os.unlink( pidfile )

def main( s ):
        
    pidfile = "/tmp/dbmanager.pid"
    if os.path.isfile( pidfile ):
        print "%s already running, exiting" % pidfile
        sys.exit()
    else:
        atexit.register( cleanup, pidfile )
        file( pidfile, 'w' ).write("")
    
    startTime = time.time()
    
    url = 'http://geofon.gfz-potsdam.de/eqinfo/list.php?mode=mt&page='
    page = 1
        
    cntInsert = 0
    cntUpdate = 0
    cntError = 0
    cntSim = 0
    
    client = MongoClient()
    db = client['easywave']
    collection = db['eqs']
    
    entries = []
    
    while True:
    
        response = urllib2.urlopen( url + str(page) )
        data = response.read()
        text = data.decode('utf-8')
        
        matches = re.findall( "<a href='([^>]*?/mt.txt)'>", text )
        
        #if page == 3:
        #    break
        
        if len( matches ) == 0:
            break
            
        page += 1
        #ids = re.findall( "<a href='event.php\?id=(gfz(\d\d\d\d)\w\w\w\w)'>", text )
                    
        for m in matches:
            print m
            eid = re.findall( "/(gfz\d\d\d\d\w\w\w\w)/", m )[0]
            print eid
            response = urllib2.urlopen( 'http://geofon.gfz-potsdam.de' + m )
            data = response.read()
            txt = data.decode('utf-8')
            
            prop = re.findall( s, txt )
            
            if len(prop) == 0:
                print 'Error'
                cntError += 1
                continue
                
            prop = prop[0]
                
            date = datetime.datetime.strptime( prop[0] + " " + prop[1], "%y/%m/%d %H:%M:%S.%f")
            
            print date
            print 'lon, lat: %f, %f' % ( float(prop[4]), float(prop[3]) )
            
            iho_region = isPointInsidePoylgon( "World_Seas.kml", LatLon( float(prop[3]), float(prop[4]) ) )
            
            entry = { "_id": eid,
                      "user": "gfz",
                      "prop":
                      {
                        "date": date,
                        "region": prop[2],
                        "latitude": float(prop[3]),
                        "longitude": float(prop[4]),
                        "magnitude": float(prop[5]),
                        "depth": float(prop[6]),
                        "dip": float(prop[7]),
                        "strike": float(prop[8]),
                        "rake": float(prop[9]),
                        "sea_area": iho_region
                       },
                     }
                                                    
            # check if there is already an entry for this id
            ret = collection.find( { "_id": eid } )
            
            if ret.count() == 0:
                             
                entries.append( (1, entry) )
            
            else:
                
                # now check if the stored entry matches in all components --> else we have an update here
                ret2 = collection.find( entry )
                
                if ret2.count() == 0:
                    # update entry
                    entries.append( (2, entry) )
                else:
                    break;
    
    for entry in reversed( entries ):
        
        timestamp = datetime.datetime.utcnow()
        
        entry[1].update( {"timestamp": timestamp} );
        
        process = { "process": [] }
    
        entry[1].update( process );
        
        if entry[0] == 1:
            cntInsert += 1
            
        if entry[0] == 2:
            collection.remove( { "_id": entry[1]["_id"] } )
            cntUpdate += 1
            
        collection.insert( entry[1] )
        
        event = { "id": entry[1]["_id"],
                  "user": "gfz",
                  "timestamp": timestamp,
                  "event": "new"
                 }
        
        prop = entry[1]["prop"]
        
        if prop["sea_area"] != None and prop["magnitude"] > 5.5 and prop["depth"] < 100:
            # request simulation of this event
            req = urllib2.Request('http://localhost:8080/GeoHazardServices/srv/requestById')
            req.add_data( urllib.urlencode( {'id' : entry[1]['_id'], 'key' : 'ABC0123456789def' } ) )
            urllib2.urlopen( req )
            
            cntSim += 1
                   
        else:
            # TODO: can this be handled by the server?
            db["events"].insert( event )
                    
        time.sleep( 0.001 )
                    
    print 'Inserted: %u' % cntInsert
    print 'Updated: %u' % cntUpdate
    print 'Errors: %u' % cntError
    print 'Pages: %u' % page
    print 'Simulated: %u' % cntSim
    
    endTime = time.time()
    
    print "Duration: %u" % (endTime - startTime)
    
    
if __name__ == "__main__":
    
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
    
    main( s )
