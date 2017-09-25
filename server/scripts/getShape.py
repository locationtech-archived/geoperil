#!/usr/bin/python3

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

import re
import sys
from pymongo import MongoReplicaSetClient

client = MongoReplicaSetClient("mongodb://tcnode1,tcnode2,tcnode3/?replicaSet=tcmongors0" ,w="majority")
db = client['trideccloud']
collection = db['comp']

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
          "type": "ISO",
          "process": 0,
          "arrT": int(arrT),
          "points": points
         }
    
#collection.update( { '_id': id}, { "$push": { 'process.0.shapes': shape } } )
collection.insert( shape )

kml.close()
client.close()
