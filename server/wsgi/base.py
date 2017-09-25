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
import cherrypy
from cherrypy.lib.static import serve_file
from cherrypy._cperror import HTTPError,HTTPRedirect
import time
import json
import logging
import inspect
import atexit
import datetime
from pymongo import MongoClient, MongoReplicaSetClient
from pymongo.read_preferences import ReadPreference
from uuid import UUID, uuid4
import hashlib
from base64 import b64encode, b64decode
from copy import copy, deepcopy
from bson.objectid import ObjectId
from bson.objectid import InvalidId
import configparser
from urllib.parse import urlparse
import subprocess
import surfer

config = configparser.ConfigParser()

def loadconfig(cfgfile):
    config.read(os.path.dirname(os.path.realpath(__file__)) + "/" + cfgfile)

loadconfig("config.cfg")

logging.basicConfig(level=logging.INFO)

cherrypy.config.update({
    'environment': 'embedded',
    'tools.sessions.on': False,
})

if cherrypy.__version__.startswith('3.0') and cherrypy.engine.state == 0:
    cherrypy.engine.start(blocking=False)
    atexit.register(cherrypy.engine.stop)

class JSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, ObjectId):
            return str(o)
        if isinstance(o, datetime.datetime):
            return str(o)
        return json.JSONEncoder.default(self, o)

def startapp(app):
    if config["mongodb"].getboolean('replicaset'):
        print("Connecting to MongoDB ReplicaSet: %s" % config["mongodb"]["url"])
        dbe = MongoReplicaSetClient(config["mongodb"]["url"],w="majority",
            max_pool_size=16,socketTimeoutMS=60000,connectTimeoutMS=30000,waitQueueTimeoutMS=60000,waitQueueMultiple=64)
        atexit.register(dbe.close)
    else:
        print("Connecting to MongoDB: %s" % config["mongodb"]["url"])
        dbe = MongoClient(config["mongodb"]["url"],
            max_pool_size=16,socketTimeoutMS=60000,connectTimeoutMS=30000,waitQueueTimeoutMS=60000,waitQueueMultiple=64)
    db = dbe[config["mongodb"]["dbname"]]
    return cherrypy.Application( app( db ) , script_name=None, config=None)

def recursivelistdir(d):
    files = []
    for f in os.listdir(d):
        f = os.path.join(d,f)
        if os.path.isdir(f):
            files.extend(recursivelistdir(f))
        else:
            files.append(f)
    return files

def hashfile(filename):
    h = hashlib.new("sha256")
    f = open(filename, "rb")
    buf = f.read(4096)
    while len(buf)>0:
        h.update(buf)
        buf = f.read(4096)
    f.close()
    return h.hexdigest()

def checkpassword(password,pwsalt,pwhash):
    return pwhash == createsaltpwhash(password,pwsalt)[1]

def createsaltpwhash(password,salt=None):
    salt = b64encode(os.urandom(8)).decode("ascii") if salt is None else salt
    pwhash = b64encode(hashlib.new("sha256",bytes(salt + ":" + password,"utf-8")).digest()).decode("ascii")
    return salt, pwhash

def jssuccess(**d):
    cherrypy.response.headers['Content-Type'] = 'application/json'
    d["status"] = "success"
    return bytes(json.dumps(d,cls=JSONEncoder),"utf-8")

def jsfail(**d):
    cherrypy.response.headers['Content-Type'] = 'application/json'
    d["status"] = "failed"
    return bytes(json.dumps(d,cls=JSONEncoder),"utf-8")

def jsdeny(**d):
    cherrypy.response.headers['Content-Type'] = 'application/json'
    d["status"] = "denied"
    return bytes(json.dumps(d,cls=JSONEncoder),"utf-8")

def checkargs(args,*req,**reqv):
    # checkargs(args, "a", ["b", "c"], d=5, e=[1,2,3], f=[], g=[[]])
    #   a has to be in args
    #   b or c have to be in args
    #   d has to be in args and must be 5
    #   e has to be in args and must be 1, 2 or 3
    #   f must not be in args
    #   g has to be in args and must be []
    for r in req:
        if type(r) is list:
            found = False
            for a in r:
                if a in args:
                    found = True
                    break
            if not found:
                return False
        else:
            if r not in args:
                return False
    for r,v in reqv.items():
        if type(v) == list:
            if len(v) == 0 and r in args:
                return False
            elif len(v)> 0 and r in args and args[r] not in v:
                return False
        else:
            if r not in args or args[r] != v:
                return False
    return True

def intdef(s,default=0):
    try:
        return int(s)
    except (ValueError,TypeError):
        return default

def floatdef(s,default=0.0):
    try:
        return float(s)
    except (ValueError,TypeError):
        return default

