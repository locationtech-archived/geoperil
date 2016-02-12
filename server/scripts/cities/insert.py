#!/usr/bin/python3

import sys
import datetime
import csv
from pymongo import MongoReplicaSetClient
import pymongo

def extract_tsps(f_tsps):
    tsps = {}
    with open(f_tsps, 'r') as csvfile:
        csvreader = csv.reader(csvfile)
        first = True
        for row in csvreader:
            if first:
                # Find indices for headlines
                (x,y,cityid,dist) = (row.index("X"), row.index("Y"), row.index("City_ID"), row.index("City_Dist"))
                first = False
                continue
            obj = {
                "lon": float(row[x]),
                "lon_sea": float(row[x]), # TODO: remove sometime
                "lat": float(row[y]),
                "lat_sea": float(row[y]), # TODO: remove sometime
                "dist": float(row[dist]),
                "type": "city"
            }
            tsps.setdefault(row[cityid],[]).append(obj)
    return tsps

def import_cities(f_cities, tsps):
    cities = []
    all_tsps = []
    now = datetime.datetime.utcnow()
    maxid = next( db["oois"].find().sort("uid", pymongo.DESCENDING).limit(1), {"uid": 0})
    with open(f_cities, 'r') as csvfile:
        csvreader = csv.reader(csvfile)
        first = True
        relid = 0
        for row in csvreader:
            if first:
                # Find indices for headlines
                (x,y,cap,name,adm0,adm1,iso,maxpop,minpop,cityid,pop2015) = (
                    row.index("X"), row.index("Y"), row.index("CAPALT"), row.index("NAMEASCII"),
                    row.index("ADM0NAME"), row.index("ADM1NAME"), row.index("ISO_A2"), row.index("POP_MAX"),
                    row.index("POP_MIN"), row.index("City_ID"), row.index("POP2015")
                )
                first = False
                continue
            relid += 1
            obj = {
                "lon": float(row[x]),
                "lat": float(row[y]),
                "iscapital": row[cap] == "1",
                "name": row[name],
                "adm0": row[adm0],
                "adm1": row[adm1],
                "iso": row[iso],
                "popmax": float(row[maxpop]),
                "popmin": float(row[minpop]),
                "pop2015": float(row[pop2015]),
                "uid": maxid["uid"] + relid,
                "type": "city",
                "date": now
            }
            cities.append(obj)
            if row[cityid] not in tsps:
                continue
            for tsp in tsps[ row[cityid] ]:
                tsp["ref"] = obj["uid"]
                tsp["date"] = obj["date"]
                all_tsps.append(tsp)
    return (cities, all_tsps)

if len(sys.argv) < 3:
    print("Too few arguments given!")
    sys.exit(1)

client = MongoReplicaSetClient("mongodb://tcnode1,tcnode2,tcnode3/?replicaSet=tcmongors0" ,w="majority")
db = client['trideccloud']

tsps = extract_tsps(sys.argv[2])
(cities,tsps) = import_cities(sys.argv[1], tsps)

db["oois"].insert(cities)
db["tsps"].insert(tsps)

client.close()

