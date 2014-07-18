from base import *

logger = logging.getLogger("MsgSrv")

class WebGuiSrv(Base):

    @cherrypy.expose
    def index(self):
        return "Hello World!" + str(self.getUser())

    @cherrypy.expose
    def session(self):
        user = self.getUser()
        if user is not None:
            return jssuccess(username = user["username"])
        return jsfail()

    @cherrypy.expose
    @cherrypy.tools.allow(methods=['POST'])
    def signin(self, username, password):
        user = self._db["users"].find_one({"username":username})
        if user is not None:
            if "pwsalt" in user and "pwhash" in user:
                res = checkpassword(password, user["pwsalt"], user["pwhash"])
            else:
                res = user["password"] == b64encode(hashlib.new("sha256",bytes(password,"utf-8")).digest()).decode("ascii")
                if res:
                    # updating login data
                    pwsalt,pwhash = createsaltpwhash(password)
                    self._db[users].update({"username": user["username"]},{"$set": {"pwsalt": pwsalt, "pwhash": pwhash}})
            if res:
                sessionid = str(uuid4())
                while self._db["users"].find_one({"session": sessionid}) is not None:
                    sessionid = str(uuid4())
                self._db["users"].update({"username": user["username"]}, {"$set": {"session": sessionid}})
                cookie = cherrypy.response.cookie
                cookie['server_cookie'] = sessionid
                cookie['server_cookie']['path'] = '/'
                cookie['server_cookie']['max-age'] = 3600
                cookie['server_cookie']['version'] = 1
                return jssuccess()
        return jsfail()
            
    @cherrypy.expose
    def signout(self):
        user = self.getUser()
        if user is not None:
            self.db["users"].update({"username": user["username"]}, {"$set": {"session": None}})
            cookie['server_cookie'] = ""
            cookie['server_cookie']['path'] = '/'
            cookie['server_cookie']['max-age'] = 0
            cookie['server_cookie']['version'] = 1
            return jssuccess()
        return jsfail()

    @cherrypy.expose
    @cherrypy.tools.allow(methods=['POST'])
    def register(self, username, password, inst = None):
        user = self.getUser()
        if user is not None and user["permissions"].get("admin",False):
            username = str(username)
            password = str(password)
            inst = str(inst)
            if self._db["users"].find_one({"username":username}) is None:
                salt, pwhash = createsaltpwhash(password)
                newuser = {
                    "username": username,
                    "password": b64encode(hashlib.new("sha256",bytes(password,"utf-8")).digest()).decode("ascii"),
                    "pwsalt" : salt,
                    "pwhash" : pwhash,
                    "session": None,
                    "inst": inst,
                    "permissions": {
                        "admin": False,         # can change permission, create users, change users
                        "intmsg": False,        # can send internal cloud messages
                        "fax": False,           # can send fax messages
                        "mail": False,          # can send mails
                        "sms": False,           # can send sms messages
                        "ftp": False,           # can send messages to ftp/gts
                        "share": False,         # can create share links
                        "compute": False,       # can compute simulations
                        "manage": False,        # can manage their institution
                        "chart" : False,        # can view charts with sealevel data
                    },
                    "properties": {
                        "InterfaxUsername":"",
                        "InterfaxPassword":"",

                        "TwilioSID":"",
                        "TwilioToken":"",
                        "TwilioFrom":"",

                        "FtpHost":"",
                        "FtpPort":21,
                        "FtpPath":"",
                        "FtpUser":"anonymous",
                        "FtpPassword":"anonymous",
                    },
                }
                if inst is not None and self._db["institutions"].find_one({"name":inst}) is None:
                    self._db["institutions"].insert({"name":inst, "secret":None})
                self._db["users"].insert(newuser)
                return jssuccess()
            return jsfail(errors = ["User already exists."])
        return jsdeny()

    @cherrypy.expose
    def userlist(self):
        user = self.getUser()
        if user is not None and user["permissions"].get("admin",False):
            users = self._db["users"].find()
            for u in users:
                u.pop("password",None)
                u.pop("pwhash",None)
                u.pop("pwsalt",None)
            return jssuccess(users=users)
        return jsdeny()

    @cherrypy.expose
    @cherrypy.tools.allow(methods=['POST'])
    def saveuser(self, userobj):
        user = self.getUser()
        if user is not None and user["permissions"].get("admin",False):
            userobj = json.loads(userobj)
            if "_id" in userobj:
                userobj.pop("pwsalt",None)
                userobj.pop("pwhash",None)
                if "password" in userobj:
                    if len(userobj["password"])>3:
                        userobj["pwsalt"], userobj["pwhash"] = createsaltpwhash(userobj["password"])
                        userobj["password"] = b64encode(hashlib.new("sha256",bytes(userobj["password"],"utf-8")).digest()).decode("ascii")
                    else:
                        userobj.pop("password",None)
                self._db["users"].update({"_id":userobj["_id"]},{"$set":userobj})
                userobj = self._db["users"].find_one({"_id":userobj["_id"]})
                return jssuccess(user = userobj)
            return jsfail(errors = ["User not found."])
        return jsdeny()

    @cherrypy.expose
    def stationlist(self, inst=None):
        user = self.getUser()
        if user is not None:
            res = []
            if inst is None:
                stations = self._db["stations"].find()
            else:
                stations = self._db["stations"].find({"inst":inst})
            for s in stations:
                res.append(s)
            return jssuccess(stations=res)
        return jsdeny()

    @cherrypy.expose
    @cherrypy.tools.allow(methods=['POST'])
    def savestation(self, name=None, station=None):
        user = self.getUser()
        if user is not None and user["permissions"].get("manage",False):
            if station is not None and "name" in station:
                nostation = self._db["stations"].find_one({"inst":user["inst"], "name":station["name"]})
                if nostation is None:
                    station["inst"] = user["inst"]
                    if name is None:
                        self._db["stations"].insert(station)
                    else:
                        self._db["stations"].update({"inst":user["inst"], "name":name},{"$set":station})
                    station = self._db["stations"].find_one({"inst":user["inst"], "name":station["name"]})
                    return jssuccess(station = station)
                return jsfail(errors = ["Station named %s already exists." % station["name"]])
            elif station is None and name is not None:
                self._db["stations"].remove({"inst":user["inst"], "name":name})
                return jssuccess()
            return jsfail(errors = ["Either station or name are required."])
        return jsdeny()
    
    @cherrypy.expose
    def getdata(self, station, start, end=None, inst=None):
        user = self.getUser()
        if user is not None and user["permissions"].get("chart",False):
            if inst is None:
                inst = user["inst"]
            start = time.mktime(datetime.datetime.strptime(start,"%Y-%m-%dT%H:%M:%S.%fZ").timetuple())
            if end is not None:
                end = time.mktime(datetime.datetime.strptime(start,"%Y-%m-%dT%H:%M:%S.%fZ").timetuple())
            else:
                end = time.mktime(datetime.datetime.now().timetuple())
            request = {"inst":inst, "station":station, "timestamp": {"$gt":start, "$lte":end}}
            values = self._db["sealeveldata"].find(request)
            res = {"data":[],"last"=None}
            for v in values:
                if res["last"] is None or res["last"] < v["timestamp"]:
                    res["last"] = v["timestamp"]
                res["data"].append(( datetime.datetime.utcfromtimestamp(v["timestamp"]).strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
                                     v["value"] ))
            return jssuccess(station = station, **res)
        return jsdeny()

application = startapp( WebGuiSrv )
