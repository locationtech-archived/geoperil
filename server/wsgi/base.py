#!/usr/bin/env python3
import os
import cherrypy
import json
import logging
from pymongo import MongoClient
from uuid import UUID, uuid4
import hashlib
from base64 import b64encode, b64decode
from copy import copy, deepcopy

logging.basicConfig(level=logging.INFO)

cherrypy.config.update({
    'environment': 'embedded',
    'tools.sessions.on': False,
})

if cherrypy.__version__.startswith('3.0') and cherrypy.engine.state == 0:
    cherrypy.engine.start(blocking=False)
    atexit.register(cherrypy.engine.stop)

def startapp(app):
    dbe = MongoClient()
    db = dbe["easywave"]
    return cherrypy.Application( app( db ) , script_name=None, config=None)

def checkpassword(password,pwsalt,pwhash):
    return pwhash == b64encode(hashlib.new("SHA-256",pwsalt + ":" + password)).decode("ascii")

def createsaltpwhash(password):
    salt = b64encode(os.urandom(8)).decode("ascii")
    pwhash = b64encode(hashlib.new("sha256",bytes(salt + ":" + password,"utf-8")).digest()).decode("ascii")
    return salt, pwhash

def jssuccess(**d):
    cherrypy.response.headers['Content-Type'] = 'application/json'
    d["status"] = "success"
    return json.dumps(d)

def jsfail(**d):
    cherrypy.response.headers['Content-Type'] = 'application/json'
    d["status"] = "failed"
    return json.dumps(d)

def jsdeny(**d):
    cherrypy.response.headers['Content-Type'] = 'application/json'
    d["status"] = "denied"
    return json.dumps(d)

class Base:
    def __init__(self,db):
        self._db = db

    def getUser(self):
        if "server_cookie" in cherrypy.request.cookie:
            uuid = cherrypy.request.cookie["server_cookie"].value
            uuid = list(UUID(uuid).bytes)
            # java uuid workaround
            uuid = UUID(bytes=bytes(list(reversed(uuid[0:8])) + list(reversed(uuid[8:16]))))
            return self._db["users"].find_one({"session":uuid})
        return None
