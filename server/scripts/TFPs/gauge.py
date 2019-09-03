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
import argparse
import datetime
import csv

from pymongo import MongoClient


def vprint(verbose, *_args, **_kwargs):
    if verbose:
        print(*_args, **_kwargs)


def main():
    client = MongoClient("mongodb://mongo")
    dbm = client['geoperil']

    parser = argparse.ArgumentParser(
        description='Extract tsunami forecast points from PDF.'
    )
    parser.add_argument('fname', type=str)
    parser.add_argument(
        '-gauge', dest='gauge',
        action='store_true', help='GAUGE LOCATIONS'
    )
    parser.add_argument(
        '-w', dest='write',
        action='store_true', help='Write results into DB.'
    )
    parser.add_argument(
        '-dup', dest='dup', action='store_true', help='Print duplicates.')
    parser.add_argument(
        '-dist', dest='dist',
        nargs='?', type=float, help='Distance to search.'
    )
    parser.add_argument(
        '-v', dest='verbose',
        action='store_true', help='Be verbose.'
    )
    args = parser.parse_args()

    file = open(args.fname, 'r')

    done = {}

    if args.gauge:
        regex = r'^\s*(?P<name>[a-zA-Z][a-zA-Z0-9 ]+)  ' + \
            r'(?P<lat>\d*\.\d*S?N?)\s*(?P<lon>\d*\.\d*W?E?).*FT.*$'
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

    for line in file:
        match = re.search(regex, line)
        if match:
            lat = float(match.group('lat')[:-1]) * \
                (1 - 2 * match.group('lat').endswith("S"))
            lon = float(match.group('lon')[:-1]) * \
                (1 - 2 * match.group('lon').endswith("W"))
            obj = {
                "name": match.group('name').strip().replace('_', ' '),
                "lat": lat,
                "lon": lon,
            }

            if str(obj) in done:
                if args.dup:
                    print(obj)
                continue

            done[str(obj)] = True

            crs = dbm["stations"].find({"$and": [
                {"lat": {"$gt": obj["lat"] - args.dist}},
                {"lat": {"$lt": obj["lat"] + args.dist}},
                {"lon": {"$gt": obj["lon"] - args.dist}},
                {"lon": {"$lt": obj["lon"] + args.dist}}
            ]})
            mind = 2 * args.dist
            if crs.count() >= 1:
                items = list(crs)
                best = None
                for itm in items:
                    tmp = abs(obj["lat"] - itm["lat"]) + \
                        abs(obj["lon"] - itm["lon"])
                    if tmp <= mind:
                        best = itm
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
                if dbm["stations"].find_one(obj) is None:
                    obj["date"] = now
                    dbm["stations"].insert(obj)
                    ninsert += 1

    file.close()
    vprint(args.verbose, '# %d records written.' % ninsert)


if __name__ == "__main__":
    main()
