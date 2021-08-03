# GeoPeril - A platform for the computation and web-mapping of hazard specific
# geospatial data, as well as for serving functionality to handle, share, and
# communicate threat specific information in a collaborative environment.
#
# Copyright (C) 2021 GFZ German Research Centre for Geosciences
#
# SPDX-License-Identifier: Apache-2.0
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#   http://apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the Licence is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the Licence for the specific language governing permissions and
# limitations under the Licence.
#
# Contributors:
#   Johannes Spazier (GFZ)
#   Sven Reissland (GFZ)
#   Martin Hammitzsch (GFZ)
#   Matthias Rüster (GFZ)
#   Hannes Fuchs (GFZ)

import os
import re
import subprocess
import json
import pandas

from pywps import \
    Process, \
    ComplexInput, \
    LiteralInput, \
    ComplexOutput, \
    LiteralOutput, \
    WPSRequest
from pywps.response import WPSResponse
from pywps.app.exceptions import ProcessError
from pywps.inout.formats import FORMATS

import logging
LOGGER = logging.getLogger("PYWPS")


class EasyWaveCpu(Process):
    ewbinary = 'easywave'
    lat = None
    lon = None
    depth = None
    dip = None
    strike = None
    rake = None
    gridres = None
    duration = None
    mag = None
    slip = None
    length = None
    width = None
    pois = None
    gridfile = None
    faultfile = 'fault.inp'
    poisfile = 'locations.inp'
    process = None

    # TODO: could be parameters for the user in the WPS request
    intervalTimes = 10
    intervalsWavejets = [0.05, 0.3, 0.5, 1.0, 2.0, 5.0, 10.0]

    statusMsg = 'easyWave simulation started, waiting...'
    internalErrorMsg = 'Internal error'
    zeroDisplacementMsg = 'Zero initial displacement'
    ewOutputTime = 'eWave.2D.time'
    ewOutputSshmax = 'eWave.2D.sshmax'
    ewOutputPois = 'eWave.poi.ssh'
    geotiffTime = 'arrivaltimes.tiff'
    geotiffSshmax = 'waveheights.tiff'
    geojsonTime = 'arrivaltimes.geojson'
    geojsonSshmax = 'waveheights.geojson'
    csvPois = 'pois.csv'
    errorFile = 'error.msg'
    compExtraTime = 10

    def __init__(self):
        inputs = [
            LiteralInput('lat', 'Latitude', data_type='float',),
            LiteralInput('lon', 'Longitude', data_type='float'),
            LiteralInput('depth', 'Depth', data_type='float'),
            LiteralInput('dip', 'Dip', data_type='integer'),
            LiteralInput('strike', 'Strike', data_type='integer'),
            LiteralInput('rake', 'Rake', data_type='integer'),
            LiteralInput('gridres', 'Grid resolution', data_type='integer'),
            LiteralInput(
                'duration', 'Simulation duration', data_type='integer'
            ),
            LiteralInput(
                'mag', 'Fault mag', data_type='float',
                min_occurs=0, max_occurs=1
            ),
            LiteralInput(
                'slip', 'Fault slip', data_type='float',
                min_occurs=0, max_occurs=1
            ),
            LiteralInput(
                'length', 'Fault slip length', data_type='float',
                min_occurs=0, max_occurs=1
            ),
            LiteralInput(
                'width', 'Fault slip width', data_type='float',
                min_occurs=0, max_occurs=1
            ),
            ComplexInput(
                'pois', 'Points of interrest',
                min_occurs=0, max_occurs=1,
                supported_formats=[FORMATS.JSON]
            ),
        ]
        outputs = [
            LiteralOutput(
                'calctime', 'Calculation time in msec', data_type='integer'
            ),
            ComplexOutput(
                'arrivaltimes', 'Arrival times as isolines in GeoJSON format',
                as_reference=True,
                supported_formats=[FORMATS.GEOJSON]
            ),
            ComplexOutput(
                'waveheights', 'Wave heights as polygons in GeoJSON format',
                as_reference=True,
                supported_formats=[FORMATS.GEOJSON]
            ),
            ComplexOutput(
                'arrivaltimesRaw',
                'Arrival times in GeoTIFF format (raw data)',
                as_reference=True,
                supported_formats=[FORMATS.GEOTIFF]
            ),
            ComplexOutput(
                'waveheightsRaw',
                'Maximum wave heights in GeoTIFF format (raw data)',
                as_reference=True,
                supported_formats=[FORMATS.GEOTIFF]
            ),
            ComplexOutput(
                'poisWaveheights',
                'Wave heights for POIs as CSV data',
                as_reference=True,
                supported_formats=[FORMATS.TEXT]
            )
        ]

        super(EasyWaveCpu, self).__init__(
            self._handler,
            identifier='easywavecpu',
            title='EasyWave worker CPU',
            abstract='EasyWave worker with CPU computation',
            version='1',
            inputs=inputs,
            outputs=outputs,
            store_supported=True,
            status_supported=True
        )

    def createFaultFile(self):
        abspath = os.path.join(self.workdir, self.faultfile)

        with open(abspath, 'w') as f:
            first = '-location %f %f %f -strike %i -dip %i -rake %i ' % (
                self.lon, self.lat, self.depth, self.strike, self.dip,
                self.rake
            )

            if self.mag is not None:
                second = '-mw %f' % self.mag
            else:
                second = '-slip %f -size %f %f' % (
                    self.slip, self.length, self.width
                )

            f.write(first + second + '\n')

    def createPoisFile(self):
        abspath = os.path.join(self.workdir, self.poisfile)
        poilist = json.loads(self.pois)

        with open(abspath, 'w') as f:
            for item in poilist:
                if (
                    'name' not in item
                    or 'lon' not in item
                    or 'lat' not in item
                ):
                    LOGGER.error(
                        'JSON string for POIs not formatted as expected'
                    )
                    raise ProcessError(self.internalErrorMsg)

                f.write(
                    item['name'] + ' '
                    + str(item['lon']) + ' '
                    + str(item['lat']) + '\n'
                )

    def runeasywave(self):
        args = [
            self.ewbinary,
            '-grid', self.gridfile,
            '-source', self.faultfile,
            '-propagation', '10',
            '-step', '1',
            # TODO: needed? '-dump', '600',
            '-ssh_arrival', '0.001',
            '-time', str(self.duration + self.compExtraTime),
            '-verbose',
            '-adjust_ztop'
        ]

        if self.pois is not None:
            args.extend([
                '-poi', self.poisfile,
                '-poi_dt_out', '30',
                '-poi_search_dist', '20'
            ])

        self.process = subprocess.Popen(
            args,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            cwd=self.workdir
        )

    def monitorExecution(self, response: WPSResponse):
        response.update_status(self.statusMsg, 0)

        timematch = r'(\d\d):(\d\d):(\d\d).*elapsed: (\d*) msec'
        timepattern = re.compile(timematch)
        calctime = None

        while self.process.poll() is None:
            for line in iter(self.process.stdout.readline, b''):
                strline = line.decode('ascii').strip('\n')
                matched = timepattern.search(strline)

                if not matched:
                    continue

                hours = float(matched.group(1))
                totalmin = hours * 60.0 + float(matched.group(2))

                # go only up to 80 percent
                percentDone = (
                    totalmin / (self.duration + self.compExtraTime)
                ) * 80.0

                response.update_status(self.statusMsg, percentDone)

                calctime = int(matched.group(4))

        abspath = os.path.join(self.workdir, self.errorFile)

        if os.path.exists(abspath):
            ewerror = open(abspath, 'r').read()
            LOGGER.error(ewerror)

            if bool(re.match(self.zeroDisplacementMsg, ewerror)):
                raise ProcessError(self.zeroDisplacementMsg)
            else:
                raise ProcessError(self.internalErrorMsg)

        response.outputs['calctime'].data = calctime

    def convertToGeotiff(self, filename: str, destname: str):
        args = [
            'gdal_translate', '-co', 'COMPRESS=DEFLATE',
            '-of', 'GTiff', filename, destname
        ]

        gdalprocess = subprocess.Popen(
            args,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            cwd=self.workdir
        )

        gdaloutput = ''

        while gdalprocess.poll() is None:
            for line in iter(gdalprocess.stdout.readline, b''):
                gdaloutput += line.decode('ascii')

        if gdalprocess.returncode != 0:
            LOGGER.error(
                'converting to GeoTIFF failed: ' + gdaloutput
            )
            raise ProcessError(self.internalErrorMsg)

        abspath = os.path.join(self.workdir, destname)

        if not os.path.exists(abspath):
            LOGGER.error('output from gdal_translate is missing')
            raise ProcessError(self.internalErrorMsg)

    def createIsolines(self, response: WPSResponse):
        # gdal_contour -f geojson -a time -fl 10 20 ...
        # eWave.2D.time arrivaltimes.geojson
        args = [
            'gdal_contour',
            '-f', 'geojson',
            '-a', 'time',
            '-snodata', '-1.0',
            '-fl'
        ]

        for i in range(
            self.intervalTimes, self.duration + 1, self.intervalTimes
        ):
            args.append(str(i))

        geojsonTimeTemp = 'arrival_temp.geojson'
        args.append(self.ewOutputTime)
        args.append(geojsonTimeTemp)

        gdalprocess = subprocess.Popen(
            args,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            cwd=self.workdir
        )

        gdaloutput = ''

        while gdalprocess.poll() is None:
            for line in iter(gdalprocess.stdout.readline, b''):
                gdaloutput += line.decode('ascii')

        if gdalprocess.returncode != 0:
            LOGGER.error(
                'creating contours of arrival times failed: ' + gdaloutput
            )
            raise ProcessError(self.internalErrorMsg)

        abspath = os.path.join(self.workdir, geojsonTimeTemp)

        if not os.path.exists(abspath):
            LOGGER.error('output from gdal_contour is missing (arrival times)')
            raise ProcessError(self.internalErrorMsg)

        simplifyArgs = [
            'ogr2ogr', '-f', 'geojson',
            '-lco', 'COORDINATE_PRECISION=4',
            '-simplify', '0.001',
            self.geojsonTime, geojsonTimeTemp
        ]

        ogrprocess = subprocess.Popen(
            simplifyArgs,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            cwd=self.workdir
        )

        ogroutput = ''
        while ogrprocess.poll() is None:
            for line in iter(ogrprocess.stdout.readline, b''):
                ogroutput += line.decode('ascii')

        if ogrprocess.returncode != 0:
            LOGGER.error(
                'simplifying arrival times failed: ' + ogroutput
            )
            raise ProcessError(self.internalErrorMsg)

        abspath = os.path.join(self.workdir, self.geojsonTime)

        if not os.path.exists(abspath):
            LOGGER.error('output from gdal_contour is missing (arrival times)')
            raise ProcessError(self.internalErrorMsg)

        response.outputs['arrivaltimes'].data_format = FORMATS.GEOJSON
        response.outputs['arrivaltimes'].file = abspath

        self.convertToGeotiff(self.ewOutputTime, self.geotiffTime)
        gtpath = os.path.join(self.workdir, self.geotiffTime)

        response.outputs['arrivaltimesRaw'].data_format = FORMATS.GEOTIFF
        response.outputs['arrivaltimesRaw'].file = gtpath

    def createWavejets(self, response: WPSResponse):
        # gdal_contour -f geojson -p -amin wavemin -amax wavemax
        # -fl 0.3 0.5 ... eWave.2D.sshmax waveheights.geojson
        args = [
            'gdal_contour', '-f', 'geojson', '-p', '-amin', 'wavemin',
            '-amax', 'wavemax', '-fl'
        ]

        for i in self.intervalsWavejets:
            args.append(str(i))

        args.append(self.ewOutputSshmax)
        args.append(self.geojsonSshmax)

        gdalprocess = subprocess.Popen(
            args,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            cwd=self.workdir
        )

        gdaloutput = ''

        while gdalprocess.poll() is None:
            for line in iter(gdalprocess.stdout.readline, b''):
                gdaloutput += line.decode('ascii')

        if gdalprocess.returncode != 0:
            LOGGER.error(
                'creating contours of max wave heights failed: ' + gdaloutput
            )
            raise ProcessError(self.internalErrorMsg)

        abspath = os.path.join(self.workdir, self.geojsonSshmax)

        if not os.path.exists(abspath):
            LOGGER.error('output from gdal_contour is missing (wave heights)')
            raise ProcessError(self.internalErrorMsg)

        response.outputs['waveheights'].data_format = FORMATS.GEOJSON
        response.outputs['waveheights'].file = abspath

        self.convertToGeotiff(self.ewOutputSshmax, self.geotiffSshmax)
        gtpath = os.path.join(self.workdir, self.geotiffSshmax)

        response.outputs['waveheightsRaw'].data_format = FORMATS.GEOTIFF
        response.outputs['waveheightsRaw'].file = gtpath

    def createPoisResults(self, response: WPSResponse):
        abspath = os.path.join(self.workdir, self.ewOutputPois)

        if not os.path.exists(abspath):
            LOGGER.error('results for POIs are missing')
            raise ProcessError(self.internalErrorMsg)

        poispath = os.path.join(self.workdir, self.csvPois)

        csvdata = pandas.read_csv(abspath, delim_whitespace=True)
        csvdata.to_csv(poispath, index=False)

        response.outputs['poisWaveheights'].data_format = FORMATS.TEXT
        response.outputs['poisWaveheights'].file = poispath

    def _handler(self, request: WPSRequest, response: WPSResponse):
        self.lat = request.inputs['lat'][0].data
        self.lon = request.inputs['lon'][0].data
        self.depth = request.inputs['depth'][0].data
        self.dip = request.inputs['dip'][0].data
        self.strike = request.inputs['strike'][0].data
        self.rake = request.inputs['rake'][0].data
        self.gridres = request.inputs['gridres'][0].data
        self.duration = request.inputs['duration'][0].data

        if 'mag' in request.inputs:
            self.mag = request.inputs['mag'][0].data

        if 'slip' in request.inputs:
            self.slip = request.inputs['slip'][0].data

        if 'length' in request.inputs:
            self.length = request.inputs['length'][0].data

        if 'width' in request.inputs:
            self.width = request.inputs['width'][0].data

        if 'pois' in request.inputs:
            self.pois = request.inputs['pois'][0].data

        if self.mag is None and (
            self.slip is None or self.length is None or self.width is None
        ):
            raise ProcessError(
                'magnitude or slip is required '
                + '(and slip requires length and width)'
            )

        if self.gridres == 30:
            self.gridfile = '/data/grid_30.grd'
        elif self.gridres == 60:
            self.gridfile = '/data/grid_60.grd'
        elif self.gridres == 120:
            self.gridfile = '/data/grid_120.grd'
        else:
            raise ProcessError('invalid grid resolution')

        LOGGER.info(
            'Processing easyWave simulation request with params: '
            + ', '.join([
                'Lat: ' + str(self.lat), 'Lon: ' + str(self.lon),
                'Depth: ' + str(self.depth), 'Dip: ' + str(self.dip),
                'Strike: ' + str(self.strike), 'Rake: ' + str(self.rake),
                'Mag: ' + str(self.mag), 'Slip: ' + str(self.slip),
                'Length: ' + str(self.length), 'Width: ' + str(self.width),
                'Gridres: ' + str(self.gridres),
                'with POIs: ' + str(self.pois is not None),
                'Duration: ' + str(self.duration)
            ])
        )

        self.createFaultFile()

        if self.pois is not None:
            self.createPoisFile()

        self.runeasywave()

        self.monitorExecution(response)

        if self.pois is not None:
            self.createPoisResults(response)

        self.createIsolines(response)
        response.update_status(self.statusMsg, 90.0)

        self.createWavejets(response)
        response.update_status(self.statusMsg, 100.0)

        return response
