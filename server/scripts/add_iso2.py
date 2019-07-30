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

import argparse
from pymongo import MongoReplicaSetClient
import iso


def add_iso(dbm, collection, isofield, countryfield, args):
    nadd = 0
    nrej = 0
    nwritten = 0
    crs = dbm[collection].find({isofield: None})
    for item in crs:
        iso2 = iso.getIso2(item[countryfield])
        print(item[countryfield], iso2)
        if iso2 is not None:
            if args.write:
                dbm[collection].update(item, {"$set": {isofield: iso2[0]}})
                nwritten += 1
            nadd += 1
        else:
            nrej += 1
    print("nadd:", nadd)
    print("nrej:", nrej)
    print("nwritten:", nwritten)


def main():
    parser = argparse.ArgumentParser(
        description='Tries to add missing iso2 codes based on ' +
        'country/region name.'
    )
    parser.add_argument(
        '-w', dest='write',
        action='store_true', help='Write results into DB.'
    )
    args = parser.parse_args()

    client = MongoReplicaSetClient(
        "mongodb://tcnode1,tcnode2,tcnode3/?replicaSet=tcmongors0",
        w="majority"
    )
    dbm = client['trideccloud']

    print("Add iso2 for CFZs")
    add_iso(dbm, "cfcz", "ISO2", "COUNTRY", args)
    print("Add iso2 for TFPs")
    add_iso(dbm, "tfps", "iso_2", "country", args)

    client.close()


if __name__ == "__main__":
    main()
