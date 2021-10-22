#!/usr/bin/env python3

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
import json
import logging
import atexit
import datetime
import configparser
import cherrypy

config = configparser.ConfigParser()


class JSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, datetime.datetime):
            return str(o)
        return json.JSONEncoder.default(self, o)


def loadconfig(cfgfile):
    config.read(os.path.dirname(os.path.realpath(__file__)) + "/" + cfgfile)


def startapp(app):
    # do not display server and version information
    # https://stackoverflow.com/a/55209796/2249798
    # https://stackoverflow.com/a/54947461/2249798
    cherrypy.__version__ = ""
    cherrypy.config.update({"response.headers.server": ""})
    cherrypy._cperror._HTTPErrorTemplate = \
        cherrypy._cperror._HTTPErrorTemplate.replace(
            "Powered by <a href=\"http://www.cherrypy.org\">"
            + "CherryPy %(version)s</a>\n",
            "%(version)s"
        )

    return cherrypy.Application(app(), script_name=None, config=None)


def jssuccess(**d):
    cherrypy.response.headers['Content-Type'] = 'application/json'
    d["status"] = "success"
    return bytes(json.dumps(d, cls=JSONEncoder), "utf-8")


def jsfail(**d):
    cherrypy.response.headers['Content-Type'] = 'application/json'
    d["status"] = "failed"
    return bytes(json.dumps(d, cls=JSONEncoder), "utf-8")


def jsdeny(**d):
    cherrypy.response.headers['Content-Type'] = 'application/json'
    d["status"] = "denied"
    return bytes(json.dumps(d, cls=JSONEncoder), "utf-8")


loadconfig("config.cfg")

if os.environ.get('DEVELOPMENT') is not None:
    logging.basicConfig(level=logging.DEBUG)
else:
    logging.basicConfig(level=logging.WARN)

cherrypy.config.update({
    'environment': 'embedded',
    'tools.sessions.on': False,
})

cherrypy.log.access_log.propagate = False

if cherrypy.__version__.startswith('3.0') and cherrypy.engine.state == 0:
    cherrypy.engine.start(blocking=False)
    atexit.register(cherrypy.engine.stop)
