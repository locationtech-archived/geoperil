#!/usr/bin/env python3
import os
import cherrypy
from cherrypy.lib.static import serve_file
from cherrypy._cperror import HTTPError,HTTPRedirect
import time
import json
from bson.json_util import dumps
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

def startapp(app):
    if config["mongodb"].getboolean('replicaset'):
        print("Connecting to MongoDB ReplicaSet: %s" % config["mongodb"]["url"])
        dbe = MongoReplicaSetClient(config["mongodb"]["url"],w="majority",
            max_pool_size=64,socketTimeoutMS=60000,connectTimeoutMS=30000,waitQueueTimeoutMS=60000,waitQueueMultiple=32)
        atexit.register(dbe.close)
    else:
        print("Connecting to MongoDB: %s" % config["mongodb"]["url"])
        dbe = MongoClient(config["mongodb"]["url"])
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

def checkpassword(password,pwsalt,pwhash):
    return pwhash == createsaltpwhash(password,pwsalt)

def createsaltpwhash(password,salt=None):
    salt = b64encode(os.urandom(8)).decode("ascii") if salt is None else salt
    pwhash = b64encode(hashlib.new("sha256",bytes(salt + ":" + password,"utf-8")).digest()).decode("ascii")
    return salt + ':' + pwhash

def jssuccess(**d):
    cherrypy.response.headers['Content-Type'] = 'application/json'
    d["status"] = "success"
    return bytes(dumps(d),"utf-8")

def jsfail(**d):
    cherrypy.response.headers['Content-Type'] = 'application/json'
    d["status"] = "failed"
    return bytes(dumps(d),"utf-8")

def jsdeny(**d):
    cherrypy.response.headers['Content-Type'] = 'application/json'
    d["status"] = "denied"
    return bytes(dumps(d),"utf-8")

