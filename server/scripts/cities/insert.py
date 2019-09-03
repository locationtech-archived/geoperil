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
import datetime
import csv
from pymongo import MongoClient
import pymongo


def extract_tsps(f_tsps):
    tsps = {}
    with open(f_tsps, 'r') as csvfile:
        csvreader = csv.reader(csvfile)
        first = True
        for row in csvreader:
            if first:
                # Find indices for headlines
                (posx, posy, cityid, dist) = (
                    row.index("X"),
                    row.index("Y"),
                    row.index("City_ID"),
                    row.index("City_Dist")
                )
                first = False
                continue
            obj = {
                "lon": float(row[posx]),
                "lon_sea": float(row[posx]),  # TODO: remove sometime
                "lat": float(row[posy]),
                "lat_sea": float(row[posy]),  # TODO: remove sometime
                "dist": float(row[dist]),
                "type": "city"
            }
            tsps.setdefault(row[cityid], []).append(obj)
    return tsps


def import_cities(dbm, f_cities, ltsps):
    cities = []
    all_tsps = []
    now = datetime.datetime.utcnow()
    maxid = next(
        dbm["oois"].find().sort("uid", pymongo.DESCENDING).limit(1), {"uid": 0}
    )
    with open(f_cities, 'r') as csvfile:
        csvreader = csv.reader(csvfile)
        first = True
        relid = 0
        for row in csvreader:
            if first:
                # Find indices for headlines
                (
                    posx, posy, cap, name, adm0, adm1, iso,
                    maxpop, minpop, cityid, pop2015
                ) = (
                    row.index("X"), row.index("Y"), row.index("CAPALT"),
                    row.index("NAMEASCII"), row.index("ADM0NAME"),
                    row.index("ADM1NAME"), row.index("ISO_A2"),
                    row.index("POP_MAX"), row.index("POP_MIN"),
                    row.index("City_ID"), row.index("POP2015")
                )
                first = False
                continue
            relid += 1
            obj = {
                "lon": float(row[posx]),
                "lat": float(row[posy]),
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
            if row[cityid] not in ltsps:
                continue
            for tsp in ltsps[row[cityid]]:
                tsp["ref"] = obj["uid"]
                tsp["date"] = obj["date"]
                all_tsps.append(tsp)
    return (cities, all_tsps)


def main():
    if len(sys.argv) < 3:
        print("Too few arguments given!")
        sys.exit(1)

    client = MongoClient("mongodb://mongo")
    dbm = client['trideccloud']

    tsps = extract_tsps(sys.argv[2])
    (cities, tsps) = import_cities(dbm, sys.argv[1], tsps)

    dbm["oois"].insert(cities)
    dbm["tsps"].insert(tsps)

    client.close()


if __name__ == "__main__":
    main()
