#!/usr/bin/env python3

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

import os
import re
import time
import datetime
import urllib
import json
import geopandas as gpd

from shapely.geometry import Point
from pymongo import MongoClient


class LatLon:
    def __init__(self, lat, lon):
        self.lat = lat
        self.lon = lon


def is_point_inside_polygon(testpt, areas, names):
    # now start algorithm and check if the point lies inside one polygon
    count = 0
    pt = Point(testpt.lon, testpt.lat)  # GeoJSON order: lon, lat

    for area in areas:
        if area.contains(pt):
            return names[count]

        count += 1

    return None


# this is now still left in the manager to unburden the Tomcat server
# however we could move this into the server as well
def get_type(dbm, inst, entry, areas, names):

    ret = dbm['eqs'].find({"id": entry["id"]})

    if ret.count() == 0:

        # no entry with same id found --> new entry
        iho_region = is_point_inside_polygon(
            LatLon(entry["lat"], entry["lon"]),
            areas,
            names
        )
        if iho_region is not None:
            entry["sea_area"] = iho_region

        return "new"

    # convert iso date string of form YYYY-MM-DDTHH:MM:SS.mmmZ to datetime
    date = datetime.datetime.strptime(entry["date"], "%Y-%m-%dT%H:%M:%S.%fZ")

    query = {
        "prop.region": entry["name"],
        "prop.latitude": entry["lat"],
        "prop.longitude": entry["lon"],
        "prop.magnitude": entry["mag"],
        "prop.depth": entry["depth"],
        "prop.date": date,
    }

    if "dip" in entry:
        query["prop.dip"] = entry["dip"]

    if "strike" in entry:
        query["prop.strike"] = entry["strike"]

    if "rake" in entry:
        query["prop.rake"] = entry["rake"]

    query.update({
        "id": entry['id'],
        "user": inst["_id"]
    })

    # check if IHO region was set already in one of the related entries
    # returned in ret
    for rel in ret:

        if rel["prop"]["latitude"] == entry["lat"] and \
           rel["prop"]["longitude"] == entry["lon"]:

            if "sea_area" in rel["prop"] and rel["prop"]["sea_area"]:
                entry["sea_area"] = rel["prop"]["sea_area"]
                break

    # check for update
    ret = dbm['eqs'].find(query)

    if ret.count() == 0:

        # no matching entry for all properties found --> update
        if "sea_area" not in entry:
            iho_region = is_point_inside_polygon(
                LatLon(entry["lat"], entry["lon"]),
                areas,
                names
            )
            if iho_region is not None:
                entry["sea_area"] = iho_region

        return "update"

    # entry exists already
    return "existing"


def read_mt(alertsurl, entry, year, eventid):
    pattern = r"""(\d\d/\d\d/\d\d) (\d\d:\d\d:\d\d.\d\d)
(.*?)
Epicenter: (.*?) (.*?)
MW (.*?)

GFZ MOMENT TENSOR SOLUTION
Depth ([ \d]{1,3}) .*?
(?:.*?\n){8}
Best Double Couple:.*?
 NP1:Strike=([ \d]{1,3}) Dip=([ \d]{1,2}) Slip=([- \d]{1,4})
"""

    urlprefix = alertsurl + "/" + str(year) + "/" + eventid + "/"

    response = urllib.request.urlopen(urlprefix + "mt.txt")
    data = response.read()
    txt = data.decode('utf-8')

    prop = re.findall(pattern, txt)

    if prop == []:
        return 1

    prop = prop[0]

    entry["strike"] = int(prop[7])
    entry["dip"] = int(prop[8])
    entry["rake"] = int(prop[9])

    entry["bb_url"] = urlprefix + "bb32.png"

    return 0


def init_world_seas_lookup(regions_file):
    areas = []
    names = []

    json_regions = gpd.read_file(regions_file)

    for index, row in json_regions.iterrows():
        names.append(row['PRIMARY_NA'])
        areas.append(row['geometry'])

    return areas, names


def main():
    mongo_connection = os.environ['MONGO_CONNECTION']
    data_insert_url = os.environ['DATA_INSERT_URL']
    geofon_alerts_url = os.environ['GEOFON_ALERTS_URL']
    geofon_output = os.environ['GEOFON_OUTPUT']

    start_time = time.time()

    areas, names = init_world_seas_lookup(
        "World_water_body_limits_polygons.geojson"
    )

    cnt_total = 0
    cnt_insert = 0
    cnt_update = 0
    cnt_error = 0
    cnt_sim = 0
    cnt_known = 0

    client = MongoClient(
        mongo_connection,
        socketTimeoutMS=10000,
        connectTimeoutMS=10000
    )
    dbm = client['geoperil']
    inst = dbm['institutions'].find({"name": "gfz"})[0]
    elist = []
    events = gpd.read_file(geofon_output)

    for index, event in events.iterrows():
        cnt_total += 1

        entry = {
            "inst": inst["name"],
            "secret": inst["secret"],
            "id": event['id'],
        }

        date = datetime.datetime.strptime(
            event['time'],
            "%Y-%m-%dT%H:%M:%S"
        )
        # ISO time format YYYY-MM-DDTHH:MM:SS.mmmZ
        entry["date"] = date.isoformat() + '.000Z'
        entry["name"] = event['place']
        entry["lat"] = float(event['geometry'].y)
        entry["lon"] = float(event['geometry'].x)
        entry["mag"] = float(event['mag'])
        entry["depth"] = float(event['geometry'].z)

        # get moment tensor if available
        if event['hasMT'] == 'yes':
            ret = read_mt(geofon_alerts_url, entry, date.year, event['id'])

            if ret != 0:
                print('Error: ', entry["id"])
                cnt_error += 1
                continue

        print("Fetch:", entry["date"], entry["id"], flush=True)

        # get type of entry and set IHO region
        gtype = get_type(dbm, inst, entry, areas, names)

        if gtype in ("new", "update"):
            elist.append({"type": gtype, "entry": entry})
        else:
            cnt_known += 1

        # stop if we have seen at least 100 known entries
        # --> updates for older entries are unlikely
        if cnt_known >= 100:
            break

    client.close()

    for elem in reversed(elist):
        etype = elem["type"]
        entry = elem["entry"]

        if etype == "new":
            cnt_insert += 1
        elif etype == "update":
            cnt_update += 1

        if "sea_area" in entry and entry["mag"] > 5.5 and entry["depth"] < 100:
            cnt_sim += 1
            entry.update({"comp": 180})

        data = urllib.parse.urlencode(entry).encode('ascii')
        req = urllib.request.Request(
            data_insert_url,
            data
        )
        try:
            urllib.request.urlopen(req).read()
        except:
            print('Calling the URL failed: ' + data_insert_url)
            raise

        time.sleep(0.05)

    print('\nTotal: %u' % cnt_total)
    print('Inserted: %u' % cnt_insert)
    print('Updated: %u' % cnt_update)
    print('Errors: %u' % cnt_error)
    print('Simulated: %u' % cnt_sim)

    end_time = time.time()

    print("Duration: %u sec." % (end_time - start_time))


if __name__ == "__main__":
    main()
