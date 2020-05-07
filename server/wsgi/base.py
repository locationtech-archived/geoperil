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
import json
import logging
import atexit
import datetime
import hashlib
import configparser
from base64 import b64encode
from bson.objectid import ObjectId
from pymongo import MongoClient, MongoReplicaSetClient
import cherrypy

config = configparser.ConfigParser()


def loadconfig(cfgfile):
    config.read(os.path.dirname(os.path.realpath(__file__)) + "/" + cfgfile)


class JSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, ObjectId):
            return str(o)
        if isinstance(o, datetime.datetime):
            return str(o)
        return json.JSONEncoder.default(self, o)


def startapp(app):
    if config["mongodb"].getboolean('replicaset'):
        print(
            "Connecting to MongoDB ReplicaSet: %s" % config["mongodb"]["url"]
        )
        dbe = MongoReplicaSetClient(
            config["mongodb"]["url"],
            w="majority",
            maxPoolSize=16,
            socketTimeoutMS=60000,
            connectTimeoutMS=30000,
            waitQueueTimeoutMS=60000,
            waitQueueMultiple=64
        )
        atexit.register(dbe.close)
    else:
        print("Connecting to MongoDB: %s" % config["mongodb"]["url"])
        dbe = MongoClient(
            config["mongodb"]["url"],
            maxPoolSize=16,
            socketTimeoutMS=60000,
            connectTimeoutMS=30000,
            waitQueueTimeoutMS=60000,
            waitQueueMultiple=64
        )
    dbm = dbe[config["mongodb"]["dbname"]]
    return cherrypy.Application(app(dbm), script_name=None, config=None)


def recursivelistdir(rdir):
    files = []
    for file in os.listdir(rdir):
        file = os.path.join(rdir, file)
        if os.path.isdir(file):
            files.extend(recursivelistdir(file))
        else:
            files.append(file)
    return files


def hashfile(filename):
    hsh = hashlib.new("sha256")
    file = open(filename, "rb")
    buf = file.read(4096)
    while buf == []:
        hsh.update(buf)
        buf = file.read(4096)
    file.close()
    return hsh.hexdigest()


def checkpassword(password, pwsalt, pwhash):
    return pwhash == createsaltpwhash(password, pwsalt)[1]


def createsaltpwhash(password, salt=None):
    salt = b64encode(os.urandom(8)).decode("ascii") if salt is None else salt
    pwhash = b64encode(
        hashlib.new(
            "sha256",
            bytes(salt + ":" + password, "utf-8")
        ).digest()
    ).decode("ascii")
    return salt, pwhash


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


def checkargs(args, *req, **reqv):
    # checkargs(args, "a", ["b", "c"], d=5, e=[1,2,3], f=[], g=[[]])
    #   a has to be in args
    #   b or c have to be in args
    #   d has to be in args and must be 5
    #   e has to be in args and must be 1, 2 or 3
    #   f must not be in args
    #   g has to be in args and must be []
    for one_req in req:
        if isinstance(one_req, list):
            found = False
            for check in one_req:
                if check in args:
                    found = True
                    break
            if not found:
                return False
        else:
            if one_req not in args:
                return False
    for one_req, val in reqv.items():
        if isinstance(val, list):
            if val == [] and one_req in args:
                return False
            if val != [] and one_req in args and args[one_req] not in val:
                return False
        else:
            if one_req not in args or args[one_req] != val:
                return False
    return True


def intdef(val, default=0):
    try:
        return int(val)
    except (ValueError, TypeError):
        return default


def floatdef(val, default=0.0):
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


loadconfig("config.cfg")

logging.basicConfig(level=logging.DEBUG)

cherrypy.config.update({
    'environment': 'embedded',
    'tools.sessions.on': False,
})

if cherrypy.__version__.startswith('3.0') and cherrypy.engine.state == 0:
    cherrypy.engine.start(blocking=False)
    atexit.register(cherrypy.engine.stop)
