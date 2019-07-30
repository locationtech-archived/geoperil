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

import re
import time
import datetime
import urllib

from pymongo import MongoReplicaSetClient


class LatLon:
    def __init__(self, lat, lon):
        self.lat = lat
        self.lon = lon


def is_point_inside_polygon(testpt, areas, names):
    # now start algorithm and check if the point lies inside one polygon
    count = 0

    for area in areas:

        for ptx in area:

            inside = 0

            j = len(ptx) - 1
            for i in enumerate(ptx):

                if (
                        ptx[i].lat < testpt.lat and ptx[j].lat >= testpt.lat or
                        ptx[i].lat >= testpt.lat and ptx[j].lat < testpt.lat
                ):

                    calc = ptx[i].lon + \
                        (testpt.lat - ptx[i].lat) / \
                        (ptx[j].lat - ptx[i].lat) * \
                        (ptx[j].lon - ptx[i].lon)

                    if calc < testpt.lon:
                        inside = (inside + 1) % 2

                j = i

            if inside:
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


def read_mt(entry, rmt):

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

    response = urllib.request.urlopen('http://geofon.gfz-potsdam.de' + rmt)
    data = response.read()
    txt = data.decode('utf-8')

    prop = re.findall(pattern, txt)

    if prop == []:
        return 1

    prop = prop[0]

    date = datetime.datetime.strptime(
        prop[0] + " " + prop[1], "%y/%m/%d %H:%M:%S.%f"
    )

    # adjust to right format if milliseconds are missing
    datestr = date.isoformat()
    if '.' not in datestr:
        datestr = datestr + ".000000"

    datestr = datestr[:-3] + 'Z'  # ISO time format YYYY-MM-DDTHH:MM:SS.mmmZ

    entry["name"] = prop[2]
    entry["lat"] = float(prop[3])
    entry["lon"] = float(prop[4])
    entry["mag"] = float(prop[5])
    entry["depth"] = float(prop[6])
    entry["strike"] = float(prop[7])
    entry["dip"] = float(prop[8])
    entry["rake"] = float(prop[9])
    entry["date"] = datestr

    return 0


def init_world_seas_lookup(regions_file):
    kml_regions = open(regions_file, 'r')

    txt = kml_regions.read()

    regions = re.findall('<Placemark .*?>(.*?)</Placemark>', txt, re.S)
    names = re.findall('<span class="atr-name">NAME</span>:</strong> ' +
                       '<span class="atr-value">(.*?)</span>', txt, re.S)

    areas = []

    for region in regions:

        polygons = []

        matches = re.findall(
            '<outerBoundaryIs>.*?<coordinates>(.*?)</coordinates>',
            region,
            re.S
        )

        for match in matches:

            arr = match.split(' ')
            obj = []

            for i in arr:
                coord = i.split(',')
                obj.append(LatLon(float(coord[1]), float(coord[0])))

            polygons.append(obj)

        areas.append(polygons)

    return areas, names


def main():

    start_time = time.time()

    areas, names = init_world_seas_lookup("World_Seas.kml")

    print('Initialization of world seas regions finished')

    url = 'http://geofon.gfz-potsdam.de/eqinfo/list.php?page='
    page = 1

    cnt_total = 0
    cnt_insert = 0
    cnt_update = 0
    cnt_error = 0
    cnt_sim = 0
    cnt_known = 0

    client = MongoReplicaSetClient(
        "mongodb://tcnode1,tcnode2,tcnode3/?replicaSet=tcmongors0",
        w="majority",
        socketTimeoutMS=10000,
        connectTimeoutMS=10000
    )
    dbm = client['trideccloud']

    inst = dbm['institutions'].find({"name": "gfz"})[0]

    elist = []

    # stop if we have seen at least 100 known entries (rounded up to a
    # multiple of page size) --> updates for older entries are unlikely
    while cnt_known < 100:

        response = urllib.request.urlopen(url + str(page))
        data = response.read()
        text = data.decode('utf-8')

        pattern = (
            r"<tr.*?>.*?"
            # eventId, date
            r"<td.*?><a.*?(gfz\d\d\d\d\w\w\w\w)'>(.*?)</a></td>.*?"
            r"<td.*?>(.*?)</td>.*?"  # magnitude
            r"<td.*?>(.*?)</td>.*?"  # latitude
            r"<td.*?>(.*?)</td>.*?"  # longitude
            r"<td.*?>(.*?)</td>.*?"  # depth
            r"<td.*?>.*?</td>.*?"  # status
            r"<td.*?>(?:<a href='(.*?)'>MT</a>)?</td>.*?"  # link to mt.txt
            r"<td.*?>(.*?)</td>.*?"  # region
            r"</tr>"
        )

        matches = re.findall(pattern, text, re.MULTILINE | re.DOTALL)

        # if page == 5:
        #     break

        if matches == []:
            break

        page += 1

        for match in matches:

            # print(m)

            cnt_total += 1

            entry = {
                "inst": inst["name"],
                "secret": inst["secret"],
                "id": match[0],
            }

            ret = 0

            # parse mt.txt if moment tensor is available
            mten = match[6]
            if mten != '':
                ret = read_mt(entry, mten)
            else:
                date = datetime.datetime.strptime(
                    match[1],
                    "%Y-%m-%d %H:%M:%S"
                )
                # ISO time format YYYY-MM-DDTHH:MM:SS.mmmZ
                entry["date"] = date.isoformat() + '.000Z'
                entry["name"] = match[7]
                entry["lat"] = float(match[3][:-6]) * \
                    (1 - 2 * match[3].endswith("S"))
                entry["lon"] = float(match[4][:-6]) * \
                    (1 - 2 * match[4].endswith("W"))
                entry["mag"] = float(match[2])
                entry["depth"] = float(match[5])
            if ret != 0:
                print('Error: ', entry["id"])
                cnt_error += 1
                continue

            print("Fetch: ", entry["date"], entry["id"])

            # get type of entry and set IHO region
            gtype = get_type(dbm, inst, entry, areas, names)

            if gtype in ("new", "update"):

                elist.append({"type": gtype, "entry": entry})

            else:
                cnt_known += 1

    print('\n')

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
            'http://trideccloud.gfz-potsdam.de/srv/data_insert',
            data
        )
        urllib.request.urlopen(req).read()

        time.sleep(0.01)

    print('Total: %u' % cnt_total)
    print('Inserted: %u' % cnt_insert)
    print('Updated: %u' % cnt_update)
    print('Errors: %u' % cnt_error)
    print('Pages: %u' % page)
    print('Simulated: %u' % cnt_sim)

    client.close()
    end_time = time.time()

    print("Duration: %u" % (end_time - start_time))


if __name__ == "__main__":

    main()
