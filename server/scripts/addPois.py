#!/usr/bin/python

import sys
from pymongo import MongoClient

client = MongoClient()
db = client['easywave']
coll = db['pois']

pois = open( sys.argv[1], 'r')

for line in pois:
  arr = line.split()
  poi = { "_id": arr[0],
	  "lon": float(arr[1]),
	  "lat": float(arr[2])
	}
  coll.insert( poi );
  print poi

pois.close()
