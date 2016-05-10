from base import *
import glob
import requests
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from email.mime.text import MIMEText
from email.utils import formatdate, make_msgid
import smtplib
from bson.json_util import loads
import binascii
import string
import random

logger = logging.getLogger("AristotleSrv")

def sendmail(send_from, send_to, send_subject, send_text, send_cc = "", send_date = None, send_msgid = None):
    msg = MIMEMultipart()
    print(send_to)
    msg["From"] = send_from
    if type(send_to) == str:
        msg["To"] = send_to
    elif type(send_to) == list and len(send_to) > 0:
        msg["To"] = ", ".join(send_to)
    if type(send_cc) == str:
        msg["Cc"] = send_cc
    elif type(send_cc) == list and len(send_cc) > 0:
        msg["Cc"] = ", ".join(send_cc)
    msg["Subject"] = send_subject
    msg["Date"] = formatdate() if send_date is None else send_date
    msg["Message-ID"] = make_msgid() if send_msgid is None else send_msgid
    msg.attach(MIMEText(send_text,_charset='utf-8'))

    smtp = smtplib.SMTP(config["mail"]["server"])
    errors = []
    success = False
    try:
        res = smtp.send_message(msg)
        for k,v in res.items():
            errors.append( (k, (v[0],v[1].decode('utf-8'))) )
        success = True
    except smtplib.SMTPRecipientsRefused as ex:
        errors = {}
        for k,v in ex.recipients.items():
            errors.append( (k, (v[0],v[1].decode('utf-8'))) )
    except smtplib.SMTPSenderRefused as ex:
        errors = [ (ex.sender, (ex.smtp_code,str(ex.smtp_error))) ]
        success = None
    smtp.quit()
    return success,errors

class AristotleSrv:
    
    def __init__(self,db):
        self._db = db
    
    ########################################################################
    # Public methods which can be called via HTTP requests.                #
    # These methods are used within the front-end to interact with the     #
    # underlying database.                                                 #
    ########################################################################
    
    # for future use
    @cherrypy.expose
    def lock(self, data):
        return jssuccess()

    # for future use
    @cherrypy.expose
    def unlock(self, data):
        return jssuccess()
    
    # Store an item in the database. 'data' must be ion JSON format.
    @cherrypy.expose
    def save(self, data, apikey=None):
        # Transform JSON input data into a native object.
        data = loads(data)
        dest = data.get("type")
        # Get all IDs the user is allowed to edit. 
        ids = self.valid_ids("edit", apikey)
        # Deny access if the provided item is not contained in that list.
        if ("_id" in data and data["_id"] not in ids) or not self.check_type(dest):
            return jsdeny()
        # A new item can only be created if access to its parent object is permitted. 
        if "_id" not in data and data.get("office") not in ids and data.get("institute") not in ids and dest != 'invite':
            return jsdeny()
        # Load database entry.
        obj = self._db[dest].find_one({"_id": data.get("_id")})
        # Check for unique email address.
        if dest == "person" and self._db[dest].find_one({"mail": data.get("mail"), "_id": {"$ne": data.get("_id")}}) is not None:
             return jsfail(reason="email address already existent")
        # Mark item as changed and remove temporary properties.
        ts = int(time.time())
        data["changed"] = ts
        data.pop("__show", None)
        # Create searchable text out of all item properties.
        data["__text"] = self.get_text(data)
        # Get office location and store it in the database.
        if dest == "office":
            data.update( self._get_location(data) )
        # Ensure that the item contains an API key and generate a new one if this is not the case. 
        self.ensure_apikey(data, obj.get("apikey") if obj is not None else None)
        if obj is None:
            # Set creation time stamp..
            data["created"] = ts
            if dest == 'person':
                # Set default permissions.
                self.default_perm(data)
            # Insert item into the database and get its ID.
            id = self._db[dest].insert(data)
        else:
            # Update properties of existing item. 
            self._db[dest].update({"_id": obj["_id"]}, data)
            id = obj["_id"]
        # Log access.
        print("[ARIST] save", apikey, id)
        # Return the item's ID.
        return jssuccess(id=id)
    
    # Mark an item as deleted.
    @cherrypy.expose
    def delete(self, data, apikey=None):
        # Convert JSON input and check permissions.
        data = loads(data)
        dest = data.get("type")
        if data["_id"] not in self.valid_ids("delete", apikey) or not self.check_type(dest):
            return jsdeny()
        # Check that office or institute has no children anymore.
        if self.find({"$or": [{"office": data["_id"]}, {"institute": data["_id"]}], "deleted": {"$ne": True}}):
            return jsfail(msg="The item has child elements assigned.")
        # Mark as changed and deleted.
        data["changed"] = int(time.time())
        data["deleted"] = True;
        # Store a backup of the email address and remove the 'mail' field. Thus, deleted users cannot sign-in anymore.
        if "mail" in data:
            data["old_mail"] = data["mail"]
            del data["mail"]
        self._db[dest].update({"_id": data["_id"]}, data)        
        return jssuccess()
    
    # Deliver all items that match the search criteria and were changed since the given time stamp 'ts'. 
    @cherrypy.expose
    def search(self, ts, apikey=None, text=None, set_in="", set_id=""):
        # Return early if the user has no permission.
        ids = self.valid_ids("view", apikey)
        if ids is None:
            return jssuccess(items=[], ts=ts)
        
        # Restrict types if parameter 'set_id' is given.
        ts = int(ts)
        types = set(["institute", "office", "person", "decision", "advice", "invite"])
        set_in = set(set_in.split(",")) if set_in != "" else types
        
        query = {"_id": {"$in": ids}}
        filt = {"apikey": 0, "__text": 0, "password": 0}
        
        # Find all updated entries.
        all = self.find({"_id": {"$in": ids}, "changed": {"$gt": ts}}, {"apikey": 0})        
        
        # TODO: enable with MongoDB 2.6
        #if text is not None and text.strip() != "":
            #query.update( {"$text": {"$search": text}} )
            ##filt.update( {"score": {"$meta": "textScore"}} )
        
        # Direct search: find all items that mathc the search directly.
        res = []
        for kind in set_in.intersection(types):
            if text is None or text.strip() == "":
                res += list(self._db[kind].find(query, filt))
            else:
                # TODO: workaround until we have MongoDB 2.6
                res += [v["obj"] for v in self._db.command("text", kind, search=text, filter=query, project=filt)["results"]]
        # Resolving: pick up the parent objects of the matched items. 
        res += list(self._db["office"].find({"_id": { "$in": [v["office"] for v in res if "office" in v]} }, filt))
        res += list(self._db["institute"].find({"_id": { "$in": [v["institute"] for v in res if "institute" in v]} }, filt))
        
        # ID search: search all items that match per ID or acronym.
        if set_id != "":
            acronym_ids = [v["_id"] for v in list( self._db["institute"].find({"acronym": {"$in": set_id.split(",")}}) )]
            set_id = set( [ObjectId(v) for v in set_id.split(",") + acronym_ids if ObjectId.is_valid(v)] )
            query = {"_id": {"$in": list(set_id.intersection(ids))} }
            filt = {"apikey": 0}
            res_id = self.find(query, filt)
            res_id_ids = [v["_id"] for v in res_id]
            # Resolving upwards: pick up parent objects.
            res_up = []
            res_up += list(self._db["office"].find({"_id": { "$in": [v["office"] for v in res_id if "office" in v]} }, filt))
            res_up += list(self._db["institute"].find({"_id": { "$in": [v["institute"] for v in (res_id + res_up) if "institute" in v]} }, filt))
            # Resolving downwards: pick up child objects.
            res_dn = []
            res_dn += self.find({"institute": {"$in": res_id_ids}}, filt)
            res_id_ids += [v["_id"] for v in res_dn]
            res_dn += self.find({"office": {"$in": res_id_ids}}, filt)
            
            res_id = res_id + res_up + res_dn
            # Intersection of 'in' and 'id' search.
            res = [x for x in res + res_id if x["_id"] in [x["_id"] for x in res] and x["_id"] in [x["_id"] for x in res_id]]
        
        # Remove duplicates.
        res = [i for n, i in enumerate(res) if i["_id"] not in [x["_id"] for x in res[n + 1:]]]
        # Deliver new and updated items only.
        res = [x for x in res if x["changed"] > ts]
        # Difference between 'all' and 'res'.
        rem = [v for v in all if v["_id"] not in [x["_id"] for x in res]]
        # Mark found items as visible in the final list.
        [v.update({"__show": True}) for v in res]
        res = res + rem
        # Find max time stamp and return results.
        maxts = max([r["changed"] for r in res] + [ts])
        return jssuccess(items=res, ts=maxts)
    
    # Return the person that matches the given API key.
    @cherrypy.expose
    def whoami(self, apikey=None):
        return jssuccess(person=self._db["person"].find_one({"apikey": apikey, "deleted": {"$ne": True}}, {"__text": 0, "password": 0}))
    
    # Load predefined message texts from server.
    @cherrypy.expose
    def get_texts(self):
        cwd = os.path.dirname(os.path.realpath(__file__))
        res = {}
        # Read text for geo and meteo part from file system.
        for group in ["meteo", "geo"]:
            with open(cwd + "/invite_" + group + ".txt") as f:
                res[group] = f.read()
        return jssuccess(texts=res)
    
    # Check whether the given API key authorizes the action defined by 'perm' on the given data.
    @cherrypy.expose
    def auth(self, data, perm, apikey=None):
        data = loads(data)
        print("[ARIST] auth", apikey, data.get("name", None), data.get("_id",None))
        ids = self.valid_ids(perm, apikey)
        if "_id" in data:   # edit operation
            return jssuccess() if data["_id"] in ids else jsdeny()
        # new operation
        if "office" in data:
            return jssuccess() if data["office"] in ids else jsdeny()
        if "institute" in data:
            return jssuccess() if data["institute"] in ids else jsdeny()
        return jsdeny()
    
    # Check whether the given API key authorizes the action defined by 'perm' on the list of items given by 'data'.
    @cherrypy.expose
    def auth_many(self, data, perm, apikey=None):
        data = loads(data)
        data = [v["_id"] for v in data]
        ids = self.valid_ids(perm, apikey)
        # Create a list with valid IDs.
        valid = set(data).intersection(ids)
        # Create a list with invalid IDs.
        invalid = set(data).difference(ids)
        return jssuccess(valid=valid, invalid=invalid)
    
    # Used to obtain the API key for a given mail address. 
    @cherrypy.expose
    def login(self, mail, password=None):
        # Mail must be non-empty.
        if mail == "":
            return jsdeny()
        # Search object for given mail.
        obj = self._db["person"].find_one({"mail": mail})
        # If password is not given, check if mail exists and return.
        if password is None:
            return jsdeny() if obj is None else jssuccess(user=obj["mail"])
        # Otherwise, compare password hashes and on success, return the corresponding API key in the answer and as a cookie.  
        if obj is not None and "password" in obj:
            parts = obj["password"].partition(":")
            if checkpassword(password, parts[0], obj["password"]):
                # Set cookie that is sent to the requester.
                cookie = cherrypy.response.cookie
                cookie['apikey'] = obj.get("apikey", "")
                cookie['apikey']['path'] = '/'
                return jssuccess(apikey=obj.get("apikey", ""))
        return jsdeny()
    
    # A newly generated password will be sent to the provided mail address.
    @cherrypy.expose
    def reset_pwd(self, mail):
        # Mail must not be empty.
        if mail == "":
            return jsdeny()
        # Search object for given mail.
        obj = self._db["person"].find_one({"mail": mail})
        if obj is not None:
            # Generate password and sent email.
            pwd = self._new_password()
            hash = createsaltpwhash(pwd)
            self._db["person"].update({"_id": obj["_id"]}, {"$set": {"password": hash}})
            sendmail(
                "aristotle-inventory@gfz-potsdam.de",
                obj["mail"],
                "ARISTOTLE: password reset",
                "Your password was set to:\n\n\t%s\n\nPlease sign in and change your password." % pwd                
            )
            return jssuccess()
        # Mail address is unknown.
        return jsfail()
    
    # Used to change the user's password.
    @cherrypy.expose
    def change_pwd(self, mail, curpwd, newpwd):
        # Mail must not be empty.
        if mail == "":
            return jsdeny()
        obj = self._db["person"].find_one({"mail": mail})
        # Compare current passwords and if they match, store the hash of the new password in the database.
        if obj is not None and "password" in obj:
            parts = obj["password"].partition(":")
            if checkpassword(curpwd, parts[0], obj["password"]):
                hash = createsaltpwhash(newpwd)
                self._db["person"].update({"_id": obj["_id"]}, {"$set": {"password": hash}})
                return jssuccess()
        # Current password does not match. 
        return jsdeny()
    
    # Confirm a requested invite.
    @cherrypy.expose
    def confirm(self, id, apikey=None):
        # Check permissions.
        id = loads(id)
        if id not in self.valid_ids("edit", apikey):
            return jsdeny()
        item = self._db["invite"].find_one({"_id": id})
        if item is None:
            return jsfail()
        # Create contact, office, institute and optionally send mails.
        data = {
            "inst_acronym": "",
            "inst_name": item["new_institute"],
            "office_name": item["new_office"],
            "name": item["name"],
            "mail": item["to"],
            "phone": "",
            "from": item["from"],
            "cc": item["cc"]
        }
        self._invite(data, item["text"], apikey, mail=True)
        # Mark invite as deleted, confirmed and changed.
        item["deleted"] = True
        item["confirmed"] = True
        item["changed"] = int(time.time())
        self._db["invite"].update({"_id": id}, item);
        return jssuccess()
    
    # deprecated, replaced by 'search'
    @cherrypy.expose
    def load(self, ts, apikey=None):
        print("[ARIST] load", apikey)
        ids = self.valid_ids("view", apikey)
        if ids is None:
            return jssuccess(items=[], ts=ts)
        
        ts = int(ts)
        res = self.find({
            "_id": {"$in": ids},
            "changed": {"$gt": ts}
        }, {
            "apikey": 0
        })
        maxts = max([r["changed"] for r in res] + [ts])
        return jssuccess(items=res, ts=maxts)

    # deprecated, defined in user interface
    @cherrypy.expose
    def new(self, role):
        if role == "office":
            office = {}
            ht = self._db["hazard_types"].find_one()
            ht.pop("_id")
            office["hazard_types"] = ht
            return jssuccess(obj=office)
        return jsfail()
    
    ########################################################################
    # Internal methods.                                                    #
    ########################################################################
        
    # Return a list of IDs that can be accessed according to the given permission.
    def valid_ids(self, perm, apikey=None):
        # Search person based on the API key and that has permissions set. 
        person = self._db["person"].find_one({
            "apikey": apikey,
            "perms.inst." + perm: {"$exists": True}
        })
        
        res = []
        # Add all open invites if the corresponding permission is set. 
        if self._db["person"].find_one({"apikey": apikey, "perms.confirm": True}) is not None:              
            res += list(self._db["invite"].find())
        
        if apikey is not None and person is not None:
            # Get list of institute IDs. 
            ids = person["perms"]["inst"][perm]
            # 'None' means that the access is granted to all institutes. Otherwise, the search is performed for the specific IDs.
            query = {} if ids is None else {"_id": {"$in": ids}}
            # List of valid institutes.
            insts = list(self._db["institute"].find(query))
            # Search all child elements.
            offices = list(self._db["office"].find({
                "institute": {"$in": [o["_id"] for o in insts]}
            }))        
            persons = list(self._db["person"].find({
                "office": {"$in": [o["_id"] for o in offices]}
            }))
            decisions = list(self._db["decision"].find({
                "institute": {"$in": [o["_id"] for o in insts]}
            }))
            advices = list(self._db["advice"].find({
                "institute": {"$in": [o["_id"] for o in insts]}
            }))
            # Combine the results.
            res += insts + offices + persons + decisions + advices
        return [o["_id"] for o in res]

    # Per default, a contact can view and edit everything that belongs to its own institute.
    def default_perm(self, obj):
        office = self._db["office"].find_one({"_id": obj["office"]})
        obj["perms"] = {
            "inst": {
                "view": [ office["institute"] ],
                "edit": [ office["institute"] ],
            }
        }

    # Verify that a valid type is used. Prevent access to collections that should not be accessed from outside.
    def check_type(self, type):
        return type == "person" or type == "office" or type == "institute" or type == "decision" or type == "advice" or type == "invite"
    
    # Pick up all text and combine them to a single space separated string. 
    def get_text(self, data):
        return ' '.join( self.get_words(data) ).replace('_', ' ') 
    
    # Walk through the item properties and pick up all text that can be found.
    def get_words(self, data):
        words = []
        for key in data:
            # Add the name of a boolean property if it is set to true.
            if data[key] == True:
                words.append(key)
            # Take strings directly, but exclude special fields.
            elif isinstance(data[key], str) and key != "__text" and key != "apikey":
                words.extend( data[key].split() )
            # Recursive call in case of a dictionary. 
            elif isinstance(data[key], dict):
                subwords = self.get_words(data[key])
                words = words + subwords + ([key] if subwords else [])
        return words
    
    # Create a new contact, its office and institute, and optionally sent an invitation mail.
    def _invite(self, data, text, apikey=None, mail=False):
        if apikey is None or self._db["person"].find_one({"apikey": apikey}) is None:
            return False
        # Search institute
        obj = {            
            "name": data["inst_name"]
        }
        inst = self._db["institute"].find_one(obj)
        if inst is None:
            # Create an new institute if not already present.
            ts = int(time.time())
            obj["created"] = ts
            obj["changed"] = ts
            obj["acronym"] = data["inst_acronym"],
            obj["type"] = "institute";            
            self._db["institute"].insert(obj)
            inst = self._db["institute"].find_one(obj)
        elif inst["_id"] not in self.valid_ids("edit", apikey):
            return False
        # Search office
        obj = {
            "name": data["office_name"],
            "institute": inst["_id"]
        }
        office = self._db["office"].find_one(obj)
        if office is None:
            # Create an new office if not already present.
            ts = int(time.time())
            obj["created"] = ts
            obj["changed"] = ts
            obj["type"] = "office";
            obj["hazard_types"] = self._db["hazard_types"].find_one()
            obj["hazard_types"].pop("_id")
            #office = self._db["office"].insert_one(obj).raw_result
            self._db["office"].insert(obj)
            office = self._db["office"].find_one(obj)
        # Search person
        obj = {
            "name": data["name"],
            "mail": data["mail"],
            "phone": data["phone"],
            "office": office["_id"]
        }
        person = self._db["person"].find_one(obj)
        ts = int(time.time())
        if person is None:
            # Create an new person if not already present.
            obj["created"] = ts
            obj["changed"] = ts
            obj["type"] = "person";
            obj["fax"] = obj["kind"] = ""
            self.ensure_apikey(obj)
            self.default_perm(obj)
            self._db["person"].insert(obj)
            person = self._db["person"].find_one(obj)
            
        # Send mail if requested.
        if mail:
            res = sendmail(
                data["from"],
                data["mail"],
                "ERCC cooperation with national institutes lawfully mandated to provide warnings and expert advice",
                text % (config["global"]["hostname"] + "/inventory.html"),
                data["cc"]
            )
            # Log result.
            print(res)
        return True
    
    # Helper method to search all relevant collections in one step. This method makes use of 'find_one' internally. 
    def find_one(self, query, filt=None):
        for dest in ["person", "office", "institute", "decision", "advice", "invite"]:
            obj = self._db[dest].find_one(query, filt)
            if obj is not None:
                return obj;
        return None
    
    # Helper method to search all relevant collections in one step. This method makes use of 'find' internally.
    def find(self, query, filt=None):
        res = []
        for dest in ["person", "office", "institute", "decision", "advice", "invite"]:
            res += list(self._db[dest].find(query, filt))
        return res

    # Generates a random key of 32 hexadecimal characters. 
    def generate_apikey(self):
        return binascii.b2a_hex(os.urandom(16)).decode("ascii")
    
    # Generates a new API key if not already present.
    def ensure_apikey(self, obj, key=None):
        obj["apikey"] = self.generate_apikey() if key is None else key
    
    # Generates a random password.
    def _new_password(self, length = 8):
        charset = string.ascii_uppercase + string.digits + "!@#$%&*"
        return ''.join(random.SystemRandom().choice(charset) for _ in range(length))
    
    ########################################################################
    # Helper methods which may be helpful to update the database entries.  #
    # These methods are not required to run the web server and only serve  #
    # debug purposes.                                                      #
    ########################################################################   
    
    #@cherrypy.expose
    def update_all_locations(self):
        res = self._db["office"].find()
        for r in res:
            self.update_location(dumps(r))
            # avoid running into API restrictions
            time.sleep(0.5)
        return jssuccess()

    #@cherrypy.expose
    def update_location(self, office):
        office = loads(office)
        loc = self._get_location(office)
        self._db["office"].update({"_id": office["_id"]}, {"$set": {"lat": loc["lat"], "lon": loc["lon"]}})
        return jssuccess(res=loc)
    
    def _get_location(self, office, provider="google"):
        if provider == "osm":
            data = {
                "format": "json",
                "city": office.get("city", None),
                "country": office.get("country", None),
                "street": office.get("address", None),
                "postalcode": office.get("zip", None)
            }
            res = requests.get("http://nominatim.openstreetmap.org/search", params=data)
            locs = json.loads(res.text)
            lat = locs[0].get("lat", None) if len(locs) > 0 else None
            lon = locs[0].get("lon", None) if len(locs) > 0 else None
            if lat is not None:
                lat = float(lat)
            if lon is not None:
                lon = float(lon)
            return {"lat": lat, "lon": lon}
        elif provider == "google":            
            data = {
                "address": " ".join([office.get("address", ""), office.get("zip", ""), office.get("city", ""), office.get("country", "")])
            }
            res = requests.get("https://maps.googleapis.com/maps/api/geocode/json", params=data)
            res = json.loads(res.text)
            loc = res["results"][0]["geometry"]["location"] if res["status"] == "OK" else {"lat": None, "lng": None}
            return {"lat": loc["lat"], "lon": loc["lng"]}
        else:
            return {"lat": None, "lon": None}
        
    #@cherrypy.expose
    def fix_all_entries(self):
        res = self.find({})
        cnt = 0
        for data in res:
            if self.fix_entry(dumps(data["_id"])):
                cnt += 1
        return jssuccess(count=cnt)

    #@cherrypy.expose
    def fix_entry(self, id):        
        id = loads(id)
        print(id)
        data = self.find_one({"_id": id})
        if data["type"] == "decision":
            if "i" in data["a"]:
                data["a"]["severity of the event"] = data["a"].pop("i")
            if "ii" in data["a"]:
                data["a"]["impact of the event"] = data["a"].pop("ii")
            if "iii" in data["a"]:
                data["a"]["details"] = data["a"].pop("iii")
            if "iv" in data["a"]:
                data["a"]["impending or imminent event"] = data["a"].pop("iv")
            # update        
            self._db[data["type"]].update({"_id": data["_id"]}, data)
            return True
        return False
        
    #@cherrypy.expose
    def invite(self, data, text, apikey=None, mail=False):
        data = loads(data)
        return jssuccess() if self._invite(data, text, apikey, mail) else jsdeny()
        
    #@cherrypy.expose
    def remind(self, data, text, apikey=None, mail=False):
        if apikey is None or self._db["person"].find_one({"apikey": apikey}) is None:
            return jsdeny()
        ids = self.valid_ids("edit", apikey)
        data = loads(data)
        # search person
        obj1 = {"name": data["name"]}
        obj2 = {"mail": data["mail"]}
        obj3 = obj1.copy()
        obj3.update(obj2)
        objs = [obj3, obj2, obj1]
        for obj in objs:
            res = list(self._db["person"].find(obj))
            if False in [(v["_id"] in ids) for v in res]:
                return jsdeny(matches=[])
            if len(res) > 1:
                return jsfail(matches=res)
            if len(res) == 1:
                # unique match found
                stat = None if not mail else sendmail(
                    data["from"],
                    data["mail"],
                    "Reminder: ERCC cooperation with national institutes lawfully mandated to provide warnings and expert advice",
                    text % (config["global"]["hostname"] + "inventory.html?" + res[0]["apikey"]),
                    data["cc"]
                )
                return jssuccess(matches=res, mail=stat)
        return jsfail(matches=[])
    
    #@cherrypy.expose
    def gen_all_texts(self):
        res = self.find({})
        for data in res:
            self.to_text(data["_id"])
        return jssuccess(count=len(res))

    #@cherrypy.expose
    def gen_text(self, id):
        self.to_text(loads(id))

    def to_text(self, id):
        data = self.find_one({"_id": id})        
        # update        
        self._db[data["type"]].update({"_id": data["_id"]}, {"$set": {"__text": self.get_text(data)}})

application = startapp( AristotleSrv )

