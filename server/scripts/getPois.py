#!/usr/bin/python

import sys
from pymongo import MongoClient

client = MongoClient()
db = client['easywave']
colPois = db['pois']
colPoisRes = db['pois_results']

id = sys.argv[2]

# read in all available stations
avail = dict()
cursor = colPois.find()

for c in cursor:
  poi = { "id": id,
	  "station": c['_id'],
	  "eta": -1,
	  "ewh": 0,
	  "lat": c['lat'],
	  "lon": c['lon']
	}
    
  avail[ c['_id'] ] = poi
    
try:
  pois = open( sys.argv[1], 'r')
    
  # skip first line
  pois.readline()
    
  for line in pois:
    arr = line.split()
  
    if not arr[0] in avail:
      print "Unknown station"
      continue
      
    poi = avail[ arr[0] ]
    poi['eta'] = arr[1]
    poi['ewh'] = arr[2]
  
  pois.close()
  
except:
  print 'File does not exist'
  
for p in avail:
  print avail[p]
  colPoisRes.insert( avail[p] );
  