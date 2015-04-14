#!/usr/bin/env python3
import os
import cherrypy
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

config = configparser.ConfigParser()
config.read(os.path.dirname(os.path.realpath(__file__)) + "/config.cfg")

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
        dbe = MongoReplicaSetClient(config["mongodb"]["url"],w="majority")
        atexit.register(dbe.close)
    else:
        dbe = MongoClient(config["mongodb"]["url"])
    db = dbe[config["mongodb"]["dbname"]]
    return cherrypy.Application( app( db ) , script_name=None, config=None)

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

    def auth_shared(self, evtId):
        if "auth_shared" in cherrypy.request.cookie:
            auth = cherrypy.request.cookie["auth_shared"].value
            try:
                objId = ObjectId(auth)
                return self._db["shared_links"].find({"_id":objId,"evtid":evtId}).count() > 0
            except InvalidId:
                return False
        return False

    def auth_api(self, key, kind):
        if kind == "user":
            return self._db["users"].find_one({"apikey":key})
        if kind == "inst":
            return self._db["inst"].find_one({"apikey":key})
        return None

    def get_hostname(self):
        url = urlparse(cherrypy.url())
        return url.scheme + "://" + url.hostname
