#!/usr/bin/env python3
import os
import cherrypy
import json
import logging
import inspect
from pymongo import MongoClient
from uuid import UUID, uuid4
import hashlib
from base64 import b64encode, b64decode
from copy import copy, deepcopy
from bson.objectid import ObjectId

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
        return json.JSONEncoder.default(self, o)

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


class Base:
    def __init__(self,db):
        self._db = db

    @cherrypy.expose
    def index(self):
        s = ""
        for n in dir(self):
            if n not in ["index"]:
                m = self.__getattribute__(n)
                if inspect.ismethod(m) and hasattr(m,"exposed") and m.exposed:
                    spec = inspect.getfullargspec(m)
                    s += "<li><b>%s</b> %s<br>" % (n, inspect.formatargspec(*spec))
        return "<html><ul>%s</ul></html>" % s

    def getUser(self):
        if "server_cookie" in cherrypy.request.cookie:
            uuid = cherrypy.request.cookie["server_cookie"].value
            return self._db["users"].find_one({"session":uuid})
        return None
