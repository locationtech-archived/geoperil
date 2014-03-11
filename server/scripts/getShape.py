#!/usr/bin/python

import re
import sys
from pymongo import MongoClient

client = MongoClient()
db = client['easywave']
collection = db['results']

print 'Parsing kml file...',

kml = open( sys.argv[1], 'r')

arrT = sys.argv[2]
id = sys.argv[3]

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
          "process": 0,
          "arrT": int(arrT),
          "points": points
         }
    
#collection.update( { '_id': id}, { "$push": { 'process.0.shapes': shape } } )
collection.insert( shape )

kml.close()

print 'done!'
