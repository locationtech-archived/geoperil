import iso
import argparse
from pymongo import MongoReplicaSetClient

def addIso(collection, isofield, countryfield, args):
    nadd = 0
    nrej = 0
    nwritten = 0
    crs = db[collection].find({isofield: None})
    for item in crs:
        iso2 = iso.getIso2(item[countryfield])
        print(item[countryfield], iso2)
        if iso2 is not None:
            if args.write:
                db[collection].update(item, {"$set": {isofield: iso2[0]}});
                nwritten += 1
            nadd += 1
        else:
            nrej += 1
    print("nadd:", nadd)
    print("nrej:", nrej)
    print("nwritten:", nwritten)

parser = argparse.ArgumentParser(description='Tries to add missing iso2 codes based on country/region name.')
parser.add_argument('-w', dest='write', action='store_true', help='Write results into DB.')
args = parser.parse_args()

client = MongoReplicaSetClient("mongodb://tcnode1,tcnode2,tcnode3/?replicaSet=tcmongors0" ,w="majority")
db = client['trideccloud']

print("Add iso2 for CFZs")
addIso("cfcz", "ISO2", "COUNTRY", args)
print("Add iso2 for TFPs")
addIso("tfps", "iso_2", "country", args)

client.close()

