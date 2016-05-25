#!/usr/bin/python3

import re
import sys
from pymongo import MongoReplicaSetClient

client = MongoReplicaSetClient("mongodb://tcnode1,tcnode2,tcnode3/?replicaSet=tcmongors0", w="majority")
db = client['trideccloud']
collection = db['comp']

kml = open( sys.argv[1], 'r')
id = sys.argv[2]
height = sys.argv[3]

txt = kml.read()

regexp = '<coordinates>(.*?)</coordinates>'

matches = re.findall( regexp, txt, re.S )

points = []

for m in matches:
    arr = m.split(' ')

    obj = []

    for i in arr:
        coord = i.split(',')
        obj.append( { "e": round( float(coord[0]), 4), "d": round( float(coord[1]), 4) } )

    points.append( obj )
    
shape = { "id": id,
          "type": "FLOOD",
          "height": height,
          "points": points
         }
    
collection.insert( shape )

kml.close()
