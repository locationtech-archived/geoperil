from basesrv import *
from msgsrv import sendmail, sendtwilliosms
import time
import datetime
import calendar
import subprocess
import base64
import math
import re
import binascii

logger = logging.getLogger("MsgSrv")

class WebGuiSrv(BaseSrv):

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
                    self._db["users"].update({"username": user["username"]},{"$set": {"pwsalt": pwsalt, "pwhash": pwhash}})
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
            cookie = cherrypy.response.cookie
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
            if inst is not None:
                inst = str(inst)
            if self._db["users"].find_one({"username":username}) is None:
                print(password)
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
                        "comp": False,          # can compute simulations
                        "manage": False,        # can manage their institution
                        "chart" : False,        # can view charts with sealevel data
                        "timeline": False       # can use timeline
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
                print(newuser["password"])
                if inst is not None and self._db["institutions"].find_one({"name":inst}) is None:
                    self._db["institutions"].insert({"name":inst, "secret":None})
                self._db["users"].insert(newuser)
                newuser.pop("password")
                newuser.pop("pwsalt")
                newuser.pop("pwhash")
                return jssuccess(user = newuser)
            return jsfail(errors = ["User already exists."])
        return jsdeny()

    @cherrypy.expose
    def instlist(self):
        user = self.getUser()
        if user is not None and user["permissions"].get("admin",False):
            insts = list( self._db["institutions"].find() )
            return jssuccess(institutions=insts)
        return jsdeny()

    @cherrypy.expose
    @cherrypy.tools.allow(methods=['POST'])
    def saveinst(self, instobj):
        user = self.getUser()
        if user is not None and user["permissions"].get("admin",False):
            instobj = json.loads(instobj)
            if self._db["institutions"].find_one({"name":instobj["name"]}) is None:
                self._db["institutions"].insert(instobj)
            else:
                instobj.pop("_id")
                self._db["institutions"].update({"name":instobj["name"]},{"$set":instobj})
            instobj = self._db["institutions"].find_one({"name":instobj["name"]})
            return jssuccess(institution = instobj)
        return jsdeny()

    @cherrypy.expose
    @cherrypy.tools.allow(methods=['POST'])
    def delinst(self, name):
        user = self.getUser()
        if user is not None and user["permissions"].get("admin",False):
            if self._db["institutions"].find_one({"name":name}) is not None:
                self._db["institutions"].remove({"name":name})
                return jssuccess()
            return jsfail(errors = ["Institution does not exist."])
        return jsdeny()

    @cherrypy.expose
    def userlist(self):
        user = self.getUser()
        if user is not None and user["permissions"].get("admin",False):
            users = list( self._db["users"].find() )
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
                # all IDs have to be translated into the ObjectId type, because they are only Strings in JS :(
                userid = ObjectId( userobj.pop("_id",None) )
                if userobj["inst"] is not None:
                    userobj["inst"] = ObjectId( userobj["inst"] )
                userobj.pop("pwsalt",None)
                userobj.pop("pwhash",None)
                if "password" in userobj:
                    print(userobj["password"])
                    if len(userobj["password"])>3:
                        userobj["pwsalt"], userobj["pwhash"] = createsaltpwhash(userobj["password"])
                        userobj["password"] = b64encode(hashlib.new("sha256",bytes(userobj["password"],"utf-8")).digest()).decode("ascii")
                        print(userobj["password"])
                    else:
                        userobj.pop("password",None)
                self._db["users"].update({"_id":userid},{"$set":userobj})
                userobj = self._db["users"].find_one({"_id":userid})
                userobj.pop("password",None)
                userobj.pop("pwsalt",None)
                userobj.pop("pwhash",None)
                return jssuccess(user = userobj)
            return jsfail(errors = ["User not found."])
        return jsdeny()

    @cherrypy.expose
    @cherrypy.tools.allow(methods=['POST'])
    def deluser(self, username):
        user = self.getUser()
        if user is not None and user["permissions"].get("admin",False):
            if self._db["users"].find_one({"username":username}) is not None:
                self._db["users"].remove({"username":username})
                return jssuccess()
            return jsfail(errors = ["User does not exist."])
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
            isotime = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%fZ")
            return jssuccess(stations=res, serverTime=isotime)
        return jsdeny()

    @cherrypy.expose
    @cherrypy.tools.allow(methods=['POST'])
    def savestation(self, name=None, station=None):
        user = self.getUser()
        inst = self._db["institutions"].find_one({"_id":user["inst"]})["name"]
        if user is not None and user["permissions"].get("manage",False):
            if station is not None and "name" in station:
                station["inst"] = inst
                station["lastmetadataupdate"] = int(time.time())
                if name is None:
                    nostation = self._db["stations"].find_one({"inst":inst, "name":station["name"]})
                    if nostation is None:
                        self._db["stations"].insert(station)
                    else:
                        return jsfail(errors = ["Station named %s already exists." % station["name"]])
                else:
                    self._db["stations"].update({"inst":inst, "name":name},{"$set":station})
                station = self._db["stations"].find_one({"inst":inst, "name":station["name"]})
                return jssuccess(station = station)
            elif station is None and name is not None:
                self._db["stations"].remove({"inst":inst, "name":name})
                return jssuccess()
            return jsfail(errors = ["Either station or name are required."])
        return jsdeny()
    
    @cherrypy.expose
    def getdata(self, station, start, end=None, inst=None):
        user = self.getUser()
        if user is not None and user["permissions"].get("chart",False):
            if inst is None:
                inst = self._db["institutions"].find_one({"_id":user["inst"]})["name"]
            start = calendar.timegm(datetime.datetime.strptime(start,"%Y-%m-%dT%H:%M:%S.%fZ").timetuple())
            if end is not None:
                end = calendar.timegm(datetime.datetime.strptime(end,"%Y-%m-%dT%H:%M:%S.%fZ").timetuple())
            else:
                end = time.mktime(datetime.datetime.now().timetuple())
            request = {"inst":inst, "station":station, "timestamp": {"$gt":start, "$lte":end}}
#            print(request)
            self._db["sealeveldata"].ensure_index([("inst",1),("station",1),("timestamp",1)])
            values = self._db["sealeveldata"].find(request).sort("timestamp",1)
            res = {"data":[],"last":None}
            for v in values:
                if res["last"] is None or res["last"] < v["timestamp"]:
                    res["last"] = v["timestamp"]
                res["data"].append(( datetime.datetime.utcfromtimestamp(v["timestamp"]).strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
                                     v["value"] ))
            return jssuccess(station = station, **res)
        return jsdeny()

    @cherrypy.expose
    def getsimdata(self, evid, station, start, end=None, ff=1):
        user = self.getUser()
        if user is not None and user["permissions"].get("chart",False):
            ff = max(int(ff),1)
            start = calendar.timegm(datetime.datetime.strptime(start,"%Y-%m-%dT%H:%M:%S.%fZ").timetuple())
            if end is not None:
                end = calendar.timegm(datetime.datetime.strptime(end,"%Y-%m-%dT%H:%M:%S.%fZ").timetuple())
            else:
                end = time.mktime(datetime.datetime.now().timetuple())
            request = {"evid":evid, "station":station, "timestamp": {"$gt":start, "$lte":end}}
#            print(request)
            self._db["simsealeveldata"].ensure_index([("evid",1),("station",1),("timestamp",1)])
            values = self._db["simsealeveldata"].find(request).sort("timestamp",1)
            res = {"data":[],"last":None}
            for v in values:
                if res["last"] is None or res["last"] < v["timestamp"]:
                    res["last"] = v["timestamp"]
                if ff>1 and "reltime" in v:
                    newreltime = v["reltime"] // ff
                    v["timestamp"] = v["timestamp"] - v["reltime"] + newreltime
                    v["reltime"] = newreltime
                res["data"].append(( datetime.datetime.utcfromtimestamp(v["timestamp"]).strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
                                     v["value"] ))
            return jssuccess(station = station, **res)
        return jsdeny()

    @cherrypy.expose
    def getcomp(self, evid, kind):
        user = self.getUser()
        if user is not None or self.auth_shared(evid):
            if kind == "CFZ":
                res = self._getcfzs(evid)
            else:
                res = list( self._db["comp"].find({"EventID":evid, "type":kind}) )
            return jssuccess(comp=res)
        return jsdeny()

    def _getcfzs(self, evid):
        res = list( self._db["comp"].find({"EventID":evid, "type":"CFZ"}) )
        for r in res:
            cfz = self._db["cfcz"].find_one({"FID_IO_DIS":r["code"]},{"_COORDS_":0})
            r.update(cfz)
        return res

    @cherrypy.expose
    def getjets(self, evid):
        user = self.getUser()
        if user is not None or self.auth_shared(evid):
            params = self._db["settings"].find({"type":"jet_color"})
            pmap = dict( (str(p["threshold"]), p["color"]) for p in params )
            jets = list( self._db["results2"].find({"id":evid}).sort([("ewh",1)]) )
            for j in jets:
                j["color"] = pmap[j["ewh"]]
            return jssuccess(jets = jets)
        return jsdeny()

    @cherrypy.expose
    def getisos(self, evid, arr):
        user = self.getUser()
        if user is not None or self.auth_shared(evid):
            res = list( self._db["results"].find({"id":evid, "arrT": {"$gt":int(arr)}}) )
            return jssuccess(comp=res)
        return jsdeny()

    @cherrypy.expose
    def gettfps(self, evid):
        user = self.getUser()
        if user is not None or self.auth_shared(evid):
            res = self._gettfps(evid)
            return jssuccess(comp=res)
        return jsdeny()
    
    # for internal use
    def _gettfps(self, evid):
        crs = self._db["tfp_comp"].find({"EventID":evid})
        res = []
        for tfp in crs:
            obj = self._db["tfps"].find_one({"_id":ObjectId(tfp["tfp"])})
            if obj is None:
                continue
            obj["ewh"] = tfp["ewh"]
            obj["eta"] = tfp["eta"]
            res.append(obj)
        return res
                
    # static division into different TFP levels
    def get_tfp_level(self, tfp):
        if(tfp["eta"] == -1):
            return None
        if(tfp["ewh"] < 0.2):
            return "INFORMATION"
        if(tfp["ewh"] < 0.5):
            return "ADVISORY"
        return "WATCH"
    
    @cherrypy.expose
    def get_msg_texts(self, evtid, kind):
        user = self.getUser()
        if user is not None:
            msgs = self._get_msg_texts(evtid, kind, user)
            return jssuccess(**msgs)
        return jsdeny()
        
    def _get_msg_texts(self, evid, kind, user=None):
        tfps = self._gettfps(evid)
        cfzs = self._getcfzs(evid)
        # get earthquake event
        eq = self._db["eqs"].find_one({"_id":evid})
        # define headlines
        headlen = 0
        # ISO-2 map used to build the SMS text later on - initialize given keys with empty sets
        iso_map = {key: set() for key in ["WATCH", "ADVISORY", "INFORMATION"]}
        # pick up neccessary data
        data = {}        
        for tfp in tfps:
            level = self.get_tfp_level( tfp )
            if level is None:
                continue
            # add new key if not already present
            if level not in data:
                data[level] = {}
            # add new key if not already present
            if tfp["country"] not in data[level]:
                data[level][ tfp["country"] ] = []
            data[level][ tfp["country"] ].append( tfp )
            headlen = max( headlen, len( tfp["country"] + "-" + tfp["name"] ) )
            # add short ISO-2 country name to set - duplicates are avoided this way
            iso_map[level].add(tfp["iso_2"])
                
        headlines = ("LOCATION-FORECAST POINT".ljust(headlen), "COORDINATES   ", "ARRIVAL TIME", "LEVEL       ")
        headlen = len( headlines[0] )
        tfp_txt = "%s %s %s %s\n" % headlines
        for head in headlines:
            tfp_txt += "%s " % "".ljust(len(head), '-')
        tfp_txt += "\n"
        
        # iterate levels WATCH and ADVISORY only if available - the sorting is done
        # using the length of the level names (WATCH, ADVISORY, INFORMATION)
        for level in sorted(data.keys() & ["WATCH", "ADVISORY"], key=lambda x: len(x) ):
            # sort items in country lists
            for country_map in data[level].values():
                country_map.sort(key=lambda x: x["eta"])
            # iterate items sorted by country ...
            for country_map in sorted(data[level].values(), key=lambda x: x[0]["eta"]):
                # ... and ETA value
                for item in country_map:
                    arr_min = math.floor(item["eta"])
                    arr_sec = math.floor( (item["eta"] % 1) * 60.0 )
                    arrival = eq["prop"]["date"] + datetime.timedelta( minutes=arr_min, seconds=arr_sec )
                    
                    tfp_txt += ("%s %5.2f%c %6.2f%c %s %s\n"
                        %( (item["country"] + "-" + item["name"]).ljust(headlen),
                           abs(item["lat_real"]),
                           "S" if item["lat_real"] < 0 else "N",
                           abs(item["lon_real"]),
                           "W" if item["lon_real"] < 0 else "E",
                           arrival.strftime("%H%MZ %d %b").upper(),
                           level
                        )
                    )
            tfp_txt += "\n"
        
        # remove all CFZs with an ETA value of -1
        cfzs = [ v for v in cfzs if v["eta"] > -1 ]
        if cfzs:
            # get maximal size of zone name
            v = max( cfzs, key=lambda x: len(x["COUNTRY"] + x["STATE_PROV"]) )
            headlen = len( v["COUNTRY"] + "-" + v["STATE_PROV"] )
            headlines = ("LOCATION-FORECAST ZONE".ljust(headlen), "ARRIVAL TIME", "LEVEL       ")
            headlen = len(headlines[0])
            # print headlines
            cfz_txt = "%s %s %s\n" % headlines
            for head in headlines:
                cfz_txt += "%s " % "".ljust(len(head), '-')
            cfz_txt += "\n"
    
            for cfz in sorted( cfzs, key=lambda x: x["eta"] ):
                level = self.get_tfp_level( cfz )
                arr_min = math.floor(cfz["eta"])
                arr_sec = math.floor( (cfz["eta"] % 1) * 60.0 )
                arrival = eq["prop"]["date"] + datetime.timedelta( minutes=arr_min, seconds=arr_sec )
                cfz_txt += ("%s %s %s\n" %(
                    (cfz["COUNTRY"] + '-' + cfz["STATE_PROV"]).ljust(headlen),
                    arrival.strftime("%H%MZ %d %b").upper(),
                    level
                ))
                # used in SMS generation later on
                iso_map[level].add(cfz["ISO2"])
            cfz_txt += "\n"
        
        # 
        applies = {}
        countries = []
        for level in sorted(data, key=lambda x: len(x) ):
            applies[level] = ""
            for country in sorted(data[level].keys()):
                if level != "INFORMATION" or country not in countries:
                    applies[level] += "%s ... " % country
                    countries.append(country)
            applies[level] = applies[level][:-5]
        
        # get message template
        template = self._db["settings"].find_one({"type": "msg_template"})
        
        nr = 1
        provider = ""
        if user is not None:
            # find next message number
            rootid = eq["root"] if eq["root"] else eq["_id"];
            cursor = self._db["messages_sent"].find({
                "EventID": rootid,
                "SenderID": user["_id"],
                "NextMsgNr": {"$ne": None}
            }).sort("CreatedTime", -1).limit(1)
            if cursor.count() > 0:
                nr = cursor[0]["NextMsgNr"] + 1
            # get tsunami provider from institution settings
            if "inst" in user:
                inst = self._db["institutions"].find_one({"_id": user["inst"]})
                if inst is not None:
                    provider += inst["msg_name"]
        else:
            provider = template["provider"]
        # build final message
        msg = template["prolog"] % (nr, provider, datetime.datetime.utcnow().strftime("%H%MZ %d %b %Y").upper())
        # summaries
        for level in sorted(data, key=lambda x: len(x) ):
            if level == "INFORMATION" and kind == "end":
                continue 
            if applies[level] != "":
                msg += template["summary"] %(
                    "END OF " if kind == "end" else "",
                    level,
                    " CANCELLATION" if kind == "cancel" else (" ONGOING" if nr > 1 and kind == "info" else ""),
                    applies[level]
                )
        msg += template["advise"]
        msg += template["params"] % (
            eq["prop"]["date"].strftime("%H%MZ %d %b %Y").upper(),
            abs(eq["prop"]["latitude"]),
            "SOUTH" if eq["prop"]["latitude"] < 0 else "NORTH",
            abs(eq["prop"]["longitude"]),
            "WEST" if eq["prop"]["longitude"] < 0 else "EAST",
            eq["prop"]["depth"],
            eq["prop"]["region"],
            eq["prop"]["magnitude"]
        )
        # measurements
        if user is not None and (kind == "info" or kind == "end"):
            text = ""
            pickings = list(self._db["pickings"].find({"userid": user["_id"], "evtid": evid, "data.pick": True}))
            for picking in pickings:
                picking["station_obj"] = self._db["stations"].find_one({"name": picking["station"]})
            if pickings:
                headlines = ["COUNTRY", "GAUGE LOCATION", "LAT   ", "LON    ", "TIME ", "AMPL  ", "PER      "]
                item = max( pickings, key=lambda x: len(x["station_obj"]["countryname"]) )
                len_country = max( len(headlines[0]), len(item["station_obj"]["countryname"]) )
                item = max( pickings, key=lambda x: len(x["station"]) )
                len_location = max( len(headlines[1]), len(item["station"]) )
                headlines[0] = headlines[0].ljust(len_country)
                headlines[1] = headlines[1].ljust(len_location)
                for head in headlines:
                    text += head + " "
                text += "\n"
                for head in headlines:
                    text += "%s " % "".ljust(len(head), '-')
                text += "\n"
            for picking in pickings:
                station = picking["station_obj"]
                text += "%s %s %5.2f%c %6.2f%c %sZ %5.2fM %6.2fMIN\n" % (
                    station["countryname"].upper().ljust(len_country),
                    station["name"].ljust(len_location),
                    abs(station["lat"]), "S" if station["lat"] < 0 else "N",
                    abs(station["lon"]), "W" if station["lon"] < 0 else "E",
                    picking["data"]["time"].replace(":",""),
                    picking["data"]["ampl"], picking["data"]["period"]
                )
            if pickings:
                msg += template["measurements"] % text
        # evaluation of WATCH, ADVISORY and INFORMATION
        if kind == "info":
            if nr == 1:
                msg += template["eval_watch_first"]
                msg += template["eval_advisory_first"]
                msg += template["eval_info_first"]
            else:
                msg += template["eval_watch_mid"]
                msg += template["eval_advisory_mid"]
        elif kind == "end":
            msg += template["eval_watch_end"]
            msg += template["eval_advisory_end"]
        
        # append table of TFP values if available
        if kind == "info":
            if "WATCH" in data or "ADVISORY" in data:
                msg += template["tfps"] % tfp_txt
        
        # append table of CFZ values if available
        if cfzs:
            msg += cfz_txt
        
        # 
        if kind == "info":
            msg += template["supplement"]
        else:
            msg += template["final"]
        msg += template["epilog"] % nr
        
        # build SMS text
        sms = "*TEST*TSUNAMI EXERCISE MSG;"
        # TODO: make dynamic?
        sms += "NEAMTWS-GFZ;"
        for level in ["WATCH", "ADVISORY"]:
            if not iso_map[level]:
                continue
            sms += level + ":"
            for iso in iso_map[level]:
                sms += iso + " "
            sms = sms[:-1] + ";"
        sms += "%s;EQ Mw%.1f;%s;%.2f%c;%.2f%c;%uKM;*TEST*" %(
            eq["prop"]["date"].strftime("%H%MZ %d%b%Y").upper(),
            eq["prop"]["magnitude"],
            eq["prop"]["region"],
            abs(eq["prop"]["latitude"]), "S" if eq["prop"]["latitude"] < 0 else "N",
            abs(eq["prop"]["longitude"]), "W" if eq["prop"]["longitude"] < 0 else "E",
            eq["prop"]["depth"],
        )  
        return {"mail": msg, "sms": sms, "msgnr": nr}
    
    # public interface to get all information about an earthquake event
    @cherrypy.expose
    def get_event_info(self,apikey,evid):
        if self.auth_api(apikey) is not None:
            cursor = self._db["eqs"].find({"$or": [{"_id":evid}, {"id":evid}]}).sort("refineId", -1).limit(1)
            if cursor.count() > 0:
                eq = cursor[0]
                # set fields explicitly to avoid returning sensible data that may be added later
                evt = {
                    "evid": eq["_id"],
                    "geofonid": eq["id"],
                    "prop": eq["prop"],
                }
                if "process" in eq:
                    evt["simulation"] = eq["process"][0]
                    if "shared_link" in eq:
                        evt["simulation"]["shared_link"] = self.get_hostname() + "/?share=" + str(eq["shared_link"]) 
                        evt["simulation"]["image_url"] = self.get_hostname() + "/snapshots/" + str(eq["shared_link"]) + ".png"
                    
                msg = self._get_msg_texts(eq['_id'], "info")["mail"]
                return jssuccess(eq=evt,msg=msg)
            return jsfail()
        return jsdeny()
    
    # create a shared link and return its ID - internal usage only
    def _make_shared_link(self, evtid, lon, lat, zoom, userid):
        obj = {
            "evtid": evtid,
            "lon": float(lon),
            "lat": float(lat),
            "zoom": int(zoom),
            "timestamp": datetime.datetime.utcnow(),
            "userid": userid
        }
        # return ID of inserted object 
        return self._db["shared_links"].insert( obj )
    
    # public interface to create a shared link
    @cherrypy.expose 
    def make_shared_link(self, evtid, lon, lat, zoom):
        user = self.getUser()
        if user is not None:
            link_id = self._make_shared_link( evtid, lon, lat, zoom, user["_id"] )
            return jssuccess(key=link_id)
        return jsdeny()
    
    # create a PNG image based on a shared link and return the file as binary data
    def make_image(self, link_id):
        # call phantomjs to make a snapshot
        path = os.path.dirname(os.path.realpath(__file__)) + "/phantomjs/"
        # provide file for download
        dst = os.path.dirname(os.path.realpath(__file__)) + "/snapshots/" + str(link_id) + '.png'
        subprocess.call(path + "phantomjs " + path + "snapshot.js " + self.get_hostname() + "/?share=" + str(link_id) + " " + dst + " '#mapview'", shell=True)
    
    # this method is called by the tomcat-server if the computation
    # of an earthquake event is completed - just a workaround until
    # we have everything merged into this python module 
    @cherrypy.expose
    def post_compute(self, evtid):
        evt = self._db["eqs"].find_one({"_id": evtid})
        link_id = None
        # create shared link and image only if a computation was performed
        if "process" in evt:
            # create shared link first
            link_id = self._make_shared_link(evt["_id"], evt["prop"]["longitude"], evt["prop"]["latitude"], 5, None )
            # create image
            self.make_image(link_id)
            # append everything to the earthquake event
            self._db["eqs"].update({"_id": evtid}, {"$set": {"shared_link": link_id}})
        # notify users only if this an official GEOFON event
        inst = self._db["institutions"].find_one({"_id": evt["user"]})
        if inst is not None and inst["name"] == "gfz":
            self._notify_users(evtid, link_id)
        return jssuccess()
    
    def _notify_users(self, evtid, link_id=None):
        template = self._db["settings"].find_one({"type": "notify_template"})
        evt = self._db["eqs"].find_one({"_id": evtid})
        cursor = self._db["eqs"].find({"id": evt["id"]}).sort("refineId", -1).skip(1).limit(1)
        old_evt = None
        if cursor.count(with_limit_and_skip=True) > 0:
            # refinement
            old_evt = cursor[0]
            #mag_diff = abs( evt["prop"]["magnitude"] - old_evt["prop"]["magnitude"] )
            now_has_mt = old_evt["prop"]["dip"] is None and evt["prop"]["dip"] is not None
            now_has_sim = "process" not in old_evt and "process" in evt
        # walk through all users and notify them if conditions are met
        for user in self._db["users"].find({"notify": {"$ne": None}, "permissions.notify": True}):
            kind = None
            if user["notify"].get("offshore") and evt["prop"]["sea_area"] is None:
                continue
            if user["notify"].get("onMag") is not None and evt["prop"]["magnitude"] >= user["notify"]["onMag"]:
                if old_evt is not None:
                    # refinement - check update parameter
                    if user["notify"].get("onSim") and now_has_sim:
                        kind = "SIM-NOC"
                    elif user["notify"].get("onMT") and now_has_mt:
                        kind = "MT-NOC"
                    #elif user["notify"].get("onMagChange") is not None and mag_diff > user["notify"]["onMagChange"]:
                    #    kind = "M-NOC"
                else:
                    # new event - check initial conditions
                    kind = "NMSG"        
            if kind is not None:
                location = "OFF SHORE" if evt["prop"]["sea_area"] is not None else "INLAND"
                if user["notify"].get("sms"):
                    twisid = user["properties"].get("TwilioSID","")
                    twitoken = user["properties"].get("TwilioToken","")
                    twifrom = user["properties"].get("TwilioFrom","")
                    to = user["notify"]["sms"]
                    text = template["sms_text"] % (
                        kind, 
                        evt["prop"]["region"],
                        evt["prop"]["magnitude"],
                        location,
                        evt["id"]
                    )
                    ret = sendtwilliosms(twisid, twitoken, twifrom, to, text)
                    print("CLOUD SMS-Notification: " + user["username"] + ", " + to + ", " + str(ret[0]))
                if user["notify"].get("mail"):
                    to = user["notify"]["mail"]
                    subject = "[TC] %s: %.1f, %uKM, %s, %s, %s" % ( 
                        kind, evt["prop"]["magnitude"], evt["prop"]["depth"],
                        location, evt["id"], evt["prop"]["region"]
                    )
                    text = template["mail_text"] % (
                        evt["prop"]["region"],
                        evt["prop"]["magnitude"],
                        location
                    )
                    if "process" in evt:
                        text += template["mail_text_sim"] % link_id
                    if user["notify"].get("includeMsg"):
                        text += template["mail_text_msg"] % self._get_msg_texts(evtid,"info")["mail"]
                    ret = sendmail("TRIDEC CLOUD <tridec-cloud-noreply@gfz-potsdam.de>", to, subject, text)
                    print("CLOUD Mail-Notification: " + user["username"] + ", " + to + ", " + str(ret[0]))        
        return

    # can be used to download the image
    @cherrypy.expose
    def get_image(self, evtid):
        evt = self._db["eqs"].find_one({"_id": evtid})
        if evt is not None:
            cd = 'attachment; filename="%s.png"' % evt["_id"]
            cherrypy.response.headers["Content-Type"] = "application/x-download"
            cherrypy.response.headers["Content-Disposition"] = cd
            return evt["image"]
        return jsfail()
    
    # retrieve a UTC timestamp from a given datetime object in UTC
    def _get_utc_timestamp(self, utc_date): 
        return (utc_date - datetime.datetime(1970, 1, 1)) / datetime.timedelta(seconds=1)
    
    # retrieve a UCT datetime object from a given UTC timestamp
    def _get_utc_date(self, utc_timestamp):
        sec_ms = str(utc_timestamp).split('.')
        sec = int(sec_ms[0])
        ms = int(sec_ms[1].ljust(6,'0')) if len(sec_ms) > 1 else 0
        return datetime.datetime.utcfromtimestamp(sec).replace(microsecond=ms)
    
    def _get_events(self, user=None, inst=None, time=0.0, limit=200):
        query = [];
        maxtime = 0.0;
        if user is not None:
            # TODO: check return values of database query
            userid = self._db["users"].find_one({"username": user})["_id"]
            query.append({"user": userid})
        if inst is not None:
            # TODO: check return values of database query
            instid = self._db["institutions"].find_one({"name": inst})["_id"]
            query.append({"user": instid})
        events = list( self._db["eqs"].find(
            {"$or": query,
             "depr": None,
             "timestamp": {"$gt": self._get_utc_date(time)}
            },
            {"image": False}
        ).sort("prop.date", -1).limit( int(limit) ))
        if len(events) > 0:
            maxtime = self._get_utc_timestamp( max( events, key=lambda x: x["timestamp"] )["timestamp"] )
        return {"events": events, "maxtime": maxtime}
    
    @cherrypy.expose
    def get_geofon_events(self, time=0.0, limit=200, apikey=None):
        if self.auth_api(apikey, "inst") is not None:
            rslt = self._get_events(None, "gfz", time, limit)
            return jssuccess(**rslt)
        return jsdeny()
        
    @cherrypy.expose
    def get_events(self, inst=None, limit=200):
        user = self.getUser()
        if user is not None:
            users = [{"user": user["_id"]}];
            inst = self._db["institutions"].find_one({"name": inst})
            if inst is not None:
                users.append({"user": inst["_id"]})
            elif "inst" in user:
                users.append({"user": user["inst"]})
            events = list( self._db["eqs"].find(
                {"$or": users,
                 "depr": None
                },
                {"image": False}
            ).sort("prop.date", -1).limit( int(limit) ))
            if len(events) > 0:
                ts = max( events, key=lambda x: x["timestamp"] )["timestamp"]
            else:
                ts = 0
            return jssuccess(events=events,ts=ts)
        return jsdeny()

    @cherrypy.expose
    def gethazardevents(self,**parameters):
        return self.get_hazard_event(**parameters)
    
    @cherrypy.expose
    def save_picking(self, evtid, station, data):
        user = self.getUser()
        if user is not None:
            self._db["pickings"].update(
                {"userid": user["_id"], "evtid": evtid, "station": station},
                {"$set": {"data": json.loads(data)} },
                upsert=True
            )
            return jssuccess()
        return jsdeny()
    
    @cherrypy.expose
    def load_picking(self, evtid, station):
        user = self.getUser()
        if user is not None:
            obj = self._db["pickings"].find_one(
                {"userid": user["_id"], "evtid": evtid, "station": station}
            )
            if obj is not None:
                return jssuccess(data=obj["data"])
            return jsfail()
        return jsdeny()
    
    @cherrypy.expose
    def saveusersettings(self, props, inst, notify, api, stations=None, curpwd=None, newpwd=None):
        user = self.getUser()
        if user is not None:
            try:
                # inititalize sub object if not present
                user["properties"] = user.get("properties",{});
                # update object with given attributes
                user["properties"].update( json.loads(props) )
                # analogous for notifications
                user["notify"] = user.get("notify",{});
                user["notify"].update( json.loads(notify) )
                inst = json.loads(inst)
                api = json.loads(api)
                # override stations
                if stations is not None:
                    user["countries"] = json.loads(stations)
            except ValueError:
                return jsfail(error = "Invalid JSON input.")
            # TODO: we should find a uniform way of password handling
            if curpwd is not None and newpwd is not None:
                if user["password"] != b64encode(hashlib.new("sha256",bytes(curpwd,"utf-8")).digest()).decode("ascii"):
                    return jsfail(error="The current password does not match.")
                if newpwd == "":
                    return jsfail(error="The new password is empty.")
                user["password"] = b64encode(hashlib.new("sha256",bytes(newpwd,"utf-8")).digest()).decode("ascii")
            if user["permissions"].get("manage",False):
                # load JSON input and remove attributes that are not allowed to change
                inst.pop("_id", None)
                inst.pop("name", None)
                self._db["institutions"].update({"_id": user["inst"]}, {"$set": inst})
            # make sure that given API-key is valid
            if user["permissions"].get("api",False) and api["key"] != "":
                if re.compile("^[0-9a-f]{32}$").match(api["key"]) is None:
                    return jsfail(error="Invalid API-key given.")
                if self._db["users"].find_one({"api.key": api["key"], "username": {"$ne": user["username"]}}) is not None:
                    return jsfail(error="Invalid API-key given.")
                if self._db["institutions"].find_one({"api.key": api["key"]}) is not None:
                    return jsfail(error="Invalid API-key given.")
                user["api"] = api;
            # update user entry - we need to remove the "_id" attribute to make pymongo happy
            user.pop("_id", None)
            self._db["users"].update({"username": user["username"]}, {"$set": user})
            return jssuccess(user=self._get_user_obj(user))
        return jsdeny()
    
    # this method collects all the user data that should be delivered to the client -
    # sensible information need to be removed
    def _get_user_obj(self, user):
        user["inst"] = self._db["institutions"].find_one({"_id": user["inst"]})
        user["inst"].pop("_id", None)
        user["inst"].pop("secret", None)
        user["inst"].pop("apikey", None)
        inst_name = user["inst"].get("name", "gfz_ex_test")
        if inst_name == "gfz":
            inst_name = "gfz_ex_test"
        pipeline = [
            { "$match": { "$and": [
                {"$or": [{"sensor": "rad"},{"sensor": "prs"},{"sensor": "pr1"},{"sensor": "flt"},{"sensor": None}]},
                {"inst": inst_name}
            ]}},
            {"$group": {"_id": "$country", "count": {"$sum": 1}}},
            {"$sort": {"_id": 1}}
        ]
        res = self._db["stations"].aggregate(pipeline)
        for r in res["result"]:
            r["on"] = (r["_id"] in user.get("countries",[])) == True
        user["countries"] = res["result"]
        # TODO: better include wanted fields explicitly instead of removing irrelevant ones
        user.pop("password", None)
        user.pop("pwhash", None)
        user.pop("pwsalt", None)
        user.pop("session", None)
        return user
    
    # generates a random key of 32 hexadecimal characters 
    @cherrypy.expose
    def generate_apikey(self):
        return jssuccess(key=binascii.b2a_hex(os.urandom(16)).decode("ascii"))
    
    @cherrypy.expose
    def generate_report(self, evtid):
        msg = self._get_msg_texts(evtid, "info")["mail"]
        evt = self._db["eqs"].find_one({"_id": evtid})
        sec = ""
        if "shared_link" in evt:
            url = self.get_hostname() + "/snapshots/" + str(evt["shared_link"]) + ".png"
            lnk = self.get_hostname() + "/?share=" +  str(evt["shared_link"])
            sec = '''
                <br>
                <img style="width: 600px;" src="%s"></img>
                <br><br>
                <a href="%s">Visit shared map at the TRIDEC CLOUD platform</a>
            ''' % (url, lnk)
        txt = '''
        <html>
            <body>
                <pre style="font-family: monospace; white-space: pre-wrap; word-wrap: break-word; font-size: 0.8em;">%s</pre>
                %s
            </body>
        </html>''' % (msg, sec)
        cherrypy.response.headers['Content-Type'] = "application/pdf"
        cherrypy.response.headers['Content-Disposition'] = 'attachment; filename="report_%s.pdf"' % evtid   
        return self.html2pdf(txt)
    
application = startapp( WebGuiSrv )
