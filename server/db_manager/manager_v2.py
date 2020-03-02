#!/usr/bin/env python3

"""
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
   Hannes Fuchs (GFZ) - refactoring

   ---

   In short, what this does:
   - connect to mongodb
   - get latest entry of institute GFZ
   - read the GEOFON GeoJSON
   - check if MT data exists -> use the data
   - check if data is already in DB
   - send new and changed (updated) entries
"""
import logging
import time
import sys
import re
from json.decoder import JSONDecodeError
from datetime import datetime, timedelta
import requests
from pymongo import MongoClient, errors as pymongo_error, DESCENDING

# NOTE: may use a configuration file
GEOFON_BASE_URL = 'https://geofon.gfz-potsdam.de/'
GEOFON_GEOJSON_ITEMS = 1000
GEOFON_GEOJSON_EXTRA_PARAMS = ''
# how much days go back from the latest entry
TIMEDELTA_IN_DAYS = 14
MONGODB_URI = 'mongodb://tcnode1,tcnode2,tcnode3/?replicaSet=tcmongors0'
#MONGODB_URI = 'mongodb://127.0.0.1:27018/?replicaSet=tcmongors0'


# quick logging setup
logger = logging.getLogger(__file__)
logger.setLevel(logging.DEBUG)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)7s - %(message)s')
ch = logging.StreamHandler()
ch.setFormatter(formatter)
ch.setLevel(logging.ERROR)
fh = logging.FileHandler('manager_v2.log')
fh.setFormatter(formatter)
fh.setLevel(logging.DEBUG)
logger.addHandler(ch)
logger.addHandler(fh)


class LatLon:
    """
    Simple class to hold the latitude and longitude of a point.
    """
    def __init__(self, lat, lon):
        self.lat = lat
        self.lon = lon


def is_point_inside_poylgon(regions_file, target):
    """
    Checks if the target point is in a region. The region is defined in the
    regions file (kml).

    :param regions_file: a kml file
    :param target: point of class LatLon
    :return: name of region
    """

    # open the kml file
    with open(regions_file, 'r') as f:
        file_contents = f.read()
        regions = re.findall(
            '<Placemark .*?>(.*?)</Placemark>',
            file_contents,
            re.S
        )
        names = re.findall(
            '<span class="atr-name">NAME</span>:</strong> <span class="atr-value">(.*?)</span>',
            file_contents, re.S
        )
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
                for e in arr:
                    coord = e.split(',')
                    obj.append(LatLon(float(coord[1]), float(coord[0])))
                polygons.append(obj)
            areas.append(polygons)

        # now start algorithm and check if the point lies inside one polygon
        nr = 0
        for area in areas:
            for p in area:
                inside = 0
                j = len(p) - 1
                for i in range(0, len(p)):
                    if p[i].lat < target.lat and p[j].lat >= target.lat or p[i].lat >= target.lat and p[j].lat < target.lat:
                        if p[i].lon + (target.lat - p[i].lat) / (p[j].lat - p[i].lat) * (p[j].lon - p[i].lon) < target.lon:
                            inside = (inside + 1) % 2
                    j = i
                if inside:
                    return names[nr]
            nr += 1
        return None


def get_type(mongodb_db, institute, entry):
    """
    Look up the entry on id in database. If no entry is found it must be a
    new one (status: 'new'). If an entry is found, the data in the db is
    compared with the provided entry data and if there are differences it
    will be updated (status: 'update'). Otherwise the entry already exists and
    the status is 'existing'.

    :param mongodb_db: mongodb connection
    :param institute: institute for authentication
    :param entry: current entry data
    :return: dict with status and updated entry
    """

    # get entry from db by id
    results = mongodb_db['eqs'].find({'id': entry['id']})

    if results.count() > 1:
        logger.info(
            'Got more than one entry (%d) in db for id: %s',
            results.count(), entry['id']
        )

    # no entry with same id found -> new entry
    if results.count() == 0:
        # get region
        iho_region = is_point_inside_poylgon(
            'World_Seas.kml',
            LatLon(entry['lat'], entry['lon'])
        )
        if iho_region:
            entry['sea_area'] = iho_region
        return {
            'status': 'new',
            'entry': entry
        }

    # convert iso date string of form YYYY-MM-DDTHH:MM:SS.mmmZ to datetime
    date_time = datetime.strptime(entry['date'], '%Y-%m-%dT%H:%M:%S.%fZ')

    # prepare query
    query = {
        'prop.region': entry['name'],
        'prop.latitude': entry['lat'],
        'prop.longitude': entry['lon'],
        'prop.magnitude': entry['mag'],
        'prop.depth': entry['depth'],
        'prop.date': date_time
    }
    if 'dip' in entry:
        query['prop.dip'] = entry['dip']
    if 'strike' in entry:
        query['prop.strike'] = entry['strike']
    if 'rake' in entry:
        query['prop.rake'] = entry['rake']
    query.update({
        'id': entry['id'],
        'user': institute['_id']
    })

    # check if IHO region was set already in one of the related entries
    # returned in results
    for result in results:
        if result['prop']['latitude'] == entry['lat'] and \
                result['prop']['longitude'] == entry['lon']:
            if 'sea_area' in result['prop'] and result['prop']['sea_area']:
                entry['sea_area'] = result['prop']['sea_area']
                break

    # check for update
    results = mongodb_db['eqs'].find(query)
    if results.count() == 0:
        # no matching entry for all properties found -> update
        if 'sea_area' not in entry:
            iho_region = is_point_inside_poylgon(
                'World_Seas.kml',
                LatLon(entry['lat'], entry['lon'])
            )
            if iho_region:
                entry['sea_area'] = iho_region
        return {
            'status': 'update',
            'entry': entry
        }

    return {
        'status': 'existing',
        'entry': entry
    }


def read_mt(feature):
    """
    Reads the remote MT (Moment tensor) file from GEOFON and pareses it to
    generate an entry with needed data to run a simulation.

    :param feature: the features of an event, provided by the GeoJson
    :return: entry
    """

    # regular expression to parse the MT file
    regex = """(\d\d/\d\d/\d\d) (\d\d:\d\d:\d\d.\d+)
(.*?)
Epicenter: (.*?) (.*?)
MW (.*?)

GFZ MOMENT TENSOR SOLUTION
Depth ([ \d]{1,3}) .*?
(?:.*?\n){8}
Best Double Couple:.*?
 NP1:Strike=([ \d]{1,3}) Dip=([ \d]{1,2}) Slip=([- \d]{1,4})
"""

    # extract the year from timestamp
    year = datetime.strptime(
        '{}Z'.format(feature['properties']['time']),
        '%Y-%m-%dT%H:%M:%SZ'
    ).strftime('%Y')

    # open the MT file and parse it
    try:
        url = '{0}data/alerts/{1}/{2}/mt.txt'.format(
            GEOFON_BASE_URL, year, feature['id']
        )
        logger.debug('request mt file: %s', url)
        request = requests.get(url)
        properties = re.findall(regex, request.text)
        if not properties:
            return None
        date_time = datetime.strptime(
            '{0} {1}'.format(properties[0][0], properties[0][1]),
            '%y/%m/%d %H:%M:%S.%f'
        )
        # using data of mt file
        entry = {
            'name': properties[0][2],
            'lat': float(properties[0][3]),
            'lon': float(properties[0][4]),
            'mag': float(properties[0][5]),
            'depth': float(properties[0][6]),
            'strike': float(properties[0][7]),
            'dip': float(properties[0][8]),
            'rake': float(properties[0][9]),
            # ISO time format YYYY-MM-DDTHH:MM:SS.mmmZ
            'date': '{0}Z'.format(date_time.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3])
        }
        return entry
    except requests.RequestException as err:
        logger.error('Failed to open MT file url: %s, error: %s', url, err)
        return None
    finally:
        request.close()


def main():
    """
    The main code to run:
    - connect mongo db
    - get institute
    - get latest entry of institute
    - load GEOFON GeoJSON with parameters (mindate) of latest entry
    - check if there is MT data
        - if so, read the MT file and get the data from it
        - if not use the data from GeoJSON
    - check if data is already in db
        - if so check if an update of the entry is needed or not
        - if not it is a new entry
    - send new and updated entries to trideccloud

    :return: None
    """
    start_time = time.time()
    stats = {
        'count_total': 0,
        'count_insert': 0,
        'count_update': 0,
        'count_error': 0,
        'count_sim': 0,
        'count_known': 0,
        'duration': 0,
    }

    institution = None
    mongodb_db = None
    latest_entry = None
    try:
        mongodb_client = MongoClient(MONGODB_URI)
        mongodb_db = mongodb_client['trideccloud']
        institution = mongodb_db['institutions'].find({"name": "gfz"})[0]
        latest_entry = mongodb_db['eqs'].find({
            'user': institution['_id']
        }).sort('timestamp', DESCENDING).limit(1)[0]
    except pymongo_error.ConnectionFailure as err:
        logger.error('Failed to connect to database: %s', err)
        sys.exit(1)

    if not institution:
        logger.error('Failed to fetch institute data')
        sys.exit(1)

    # get the features
    features = []
    try:
        url = '{0}eqinfo/list.php?fmt=geojson&nmax={1}&datemin={2}{3}'.format(
            GEOFON_BASE_URL,
            GEOFON_GEOJSON_ITEMS,
            (latest_entry['timestamp'] - timedelta(
                days=TIMEDELTA_IN_DAYS
            )).strftime('%Y-%m-%d'),
            GEOFON_GEOJSON_EXTRA_PARAMS
        )
        request = requests.get(url)
        if 'features' in request.json():
            features = request.json()['features']
        else:
            logger.error('no features in response')
    except requests.exceptions.RequestException as err:
        logger.error('Failed to open GEOFON URL: %', err)
    except JSONDecodeError as err:
        logger.error(
            'Failed to decode on url %s, request status: %s, response: %s, error: %s',
            url, request.status_code, request.text, err
        )
    finally:
        request.close()

    elements = []
    for feature in features:
        stats['count_total'] += 1

        entry = {
            'inst': institution['name'],
            'secret': institution['secret'],
            'id': feature['id']
        }

        if 'hasMT' in feature['properties'] and \
                feature['properties']['hasMT'].lower() == 'yes':
            entry_mt = read_mt(feature)
            if entry_mt:
                entry.update(entry_mt)
            else:
                stats['count_error'] += 1
                logger.error('mt parsing failed on %s', entry['id'])
        else:
            entry.update({
                # ISO time format YYYY-MM-DDTHH:MM:SS.mmmZ
                'date': '{}.000Z'.format(datetime.strptime(
                    feature['properties']['time'],
                    '%Y-%m-%dT%H:%M:%S'
                ).isoformat()),
                'name': feature['properties']['place'],
                'lat': float(feature['geometry']['coordinates'][1]),
                'lon': float(feature['geometry']['coordinates'][0]),
                'mag': float(feature['properties']['mag']),
                'depth': float(feature['geometry']['coordinates'][2]),
            })

        logger.info(
            'Fetch: %s, %s, %s',
            entry['date'], entry['id'], entry['name']
        )

        # get type of entry and set IHO region
        entry_with_type = get_type(mongodb_db, institution, entry)

        # append entries with status new or update to list
        if entry_with_type['status'] in ['new', 'update']:
            logger.debug(
                'Entry %s -> %s',
                entry_with_type['entry']['id'],
                entry_with_type['status']
            )
            elements.append({
                'status': entry_with_type['status'],
                'entry': entry_with_type['entry']
            })
        else:
            stats['count_known'] += 1

    # post the data
    for element in reversed(elements):
        status = element['status']
        entry = element['entry']

        if status == 'new':
            stats['count_insert'] += 1
        if status == 'update':
            stats['count_update'] += 1

        # only run simulation if parameters match
        if 'sea_area' in entry and entry['mag'] > 5.5 and entry['depth'] < 100:
            stats['count_sim'] += 1
            entry.update({'comp': 180})

        logger.info(
            'Sending entry %s with status %s',
            entry['id'],
            status
        )
        try:
            request = requests.post(
                'https://trideccloud.gfz-potsdam.de/srv/data_insert',
                data=entry,
            )
            logger.info(
                'status code: %d, response: %s',
                request.status_code,
                request.text
            )
        except requests.exceptions.RequestException as err:
            logger.error('Failed to post data %s', err)
        finally:
            request.close()

    mongodb_client.close()
    stats['duration'] = time.time() - start_time
    logger.info('Stats: {0}'.format(stats))


if __name__ == '__main__':
    main()
