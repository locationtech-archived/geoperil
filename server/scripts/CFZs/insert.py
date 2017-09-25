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

import sys
import re
import datetime
import csv
import iso
import pymongo
from pymongo import MongoReplicaSetClient

def import_cfzs(fcfzs, ftsps):
    f = open(fcfzs, 'r')
    content = f.read()
    cfz = re.findall('^>.*\n([^>]*\n)*', content, re.M)
    objs = []
    now = datetime.datetime.utcnow()
    maxid = list(db["cfcz"].find().sort("FID_IO_DIS", pymongo.DESCENDING).limit(1))[0]["FID_IO_DIS"]
    for poly in cfz:
        meta = re.search('^\s*#\s*@D(?P<country>[^|]*)\|(?P<state>[^|]*)\|(?P<id>[1-9][0-9]*).*$', poly, re.M)
        points = [(float(x), float(y)) for (x,y) in re.findall('(-?\d*\.\d*) (-?\d*\.\d*)', poly)]
        if re.search('^\s*#\s*@P', poly, re.M) is not None:
            obj = {
                "_COORDS_": [points],
                "COUNTRY": meta.group("country").replace('"',''),
                "STATE_PROV": meta.group("state").replace('"',''),
                "FID_IO_DIS": maxid + int(meta.group("id")),
                "date": now
            }
            print(iso.getIso2(obj["COUNTRY"]), obj["COUNTRY"])
            objs.append( obj )
        elif re.search('^\s*#\s*@H', poly, re.M) is not None:
            objs[-1]["_COORDS_"].append(points)
        else:
            raise ValueError('Unknown polygon format.')
    f.close()
    db["cfcz"].insert(objs)
    with open(ftsps, 'r') as csvfile:
        csvreader = csv.reader(csvfile)
        tsps = []
        for row in csvreader:
            tsps.append( {"lon_sea": float(row[0]), "lat_sea": float(row[1]), "FID_IO_DIS": maxid + int(row[4]), "date": now} )
        db["tsps"].insert( tsps )

if len(sys.argv) < 3:
    print("To few arguments given!")
    sys.exit()

client = MongoReplicaSetClient("mongodb://tcnode1,tcnode2,tcnode3/?replicaSet=tcmongors0" ,w="majority")
db = client['trideccloud']

import_cfzs(sys.argv[1], sys.argv[2])

client.close()

