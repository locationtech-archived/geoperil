import sys
import re
import pycountry
import argparse
from bson.objectid import ObjectId
import datetime
import csv

from pymongo import MongoReplicaSetClient

def vprint(*_args, **_kwargs):
    if args.verbose: 
        print(*_args, **_kwargs)

client = MongoReplicaSetClient("mongodb://tcnode1,tcnode2,tcnode3/?replicaSet=tcmongors0" ,w="majority")
db = client['trideccloud']

parser = argparse.ArgumentParser(description='Extract tsunami forecast points from PDF.')
parser.add_argument('fname', type=str)
parser.add_argument('-gauge', dest='gauge', action='store_true', help='GAUGE LOCATIONS')
parser.add_argument('-w', dest='write', action='store_true', help='Write results into DB.')
parser.add_argument('-dup', dest='dup', action='store_true', help='Print duplicates.')
parser.add_argument('-dist', dest='dist', nargs='?', type=float, help='Distance to search.')
parser.add_argument('-v', dest='verbose', action='store_true', help='Be verbose.')
args = parser.parse_args()

f = open( args.fname, 'r')

done = {}

if args.gauge:
    regex = '^\s*(?P<name>[a-zA-Z][a-zA-Z0-9 ]+)  (?P<lat>\d*\.\d*S?N?)\s*(?P<lon>\d*\.\d*W?E?).*FT.*$'
else:
    raise ValueError('No format given.')

now = datetime.datetime.utcnow()
ninsert = 0

names = []
with open('locations.csv', 'r') as fcsv:
    reader = csv.reader(fcsv, delimiter=';')
    for row in reader:
        if row[0] not in names:
            names.append(row[0])

for line in f:
    match = re.search(regex, line)
    if match:
        lat = float(match.group('lat')[:-1]) * (1 - 2*match.group('lat').endswith("S"))
        lon = float(match.group('lon')[:-1]) * (1 - 2*match.group('lon').endswith("W"))
        obj = { "name": match.group('name').strip().replace('_',' '),
                "lat": lat,
                "lon": lon,
              }

        if str(obj) in done:
            if args.dup:
                print(obj)
            continue

        done[ str(obj) ] = True

        crs = db["stations"].find({"$and": [
            {"lat": {"$gt": obj["lat"] - args.dist}}, 
            {"lat": {"$lt": obj["lat"] + args.dist}},
            {"lon": {"$gt": obj["lon"] - args.dist}},
            {"lon": {"$lt": obj["lon"] + args.dist}}
        ]});
        mind = 2*args.dist
        if crs.count() >= 1:
            items = list(crs)
            best = None
            for it in items:
                tmp = abs(obj["lat"] -  it["lat"]) + abs(obj["lon"] -  it["lon"])
                if tmp <= mind:
                    best = it
                    mind = tmp
            obj["lat"] = best["lat"]
            obj["lon"] = best["lon"]
            if "country" in best:
                obj["country"] = best["country"]
        name = [s for s in names if obj["name"] in s]
        if len(name) != 1:
            print("# Could not find unique name.")
            continue

        name = name[0]
        obj["Location"] = name
        obj["name"] = name.replace(' ', '_')
        if name[-3] == " " or name[-2] == " ":
            obj["countryname"] = name.split(" ")[-1]
        obj["inst"] = "gfz_ex"
        obj["source"] = "cwave16.pdf"
        print(obj)

        if args.write:
            if db["stations"].find_one(obj) is None:
                obj["date"] = now
                db["stations"].insert(obj)
                ninsert += 1

f.close()
vprint('# %d records written.' % ninsert)
