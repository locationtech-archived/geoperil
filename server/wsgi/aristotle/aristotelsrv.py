from basesrv import *
import glob
import requests
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from email.mime.text import MIMEText
from email.utils import formatdate, make_msgid
import smtplib
from bson.json_util import loads
import binascii

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

    smtp = smtplib.SMTP('cgp1.gfz-potsdam.de')
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

class AristotleSrv(BaseSrv):
    @cherrypy.expose
    def saveformdata(self,_form,**kwargs):
        doc = kwargs.copy()
        doc.pop("_id",None)
        doc["_ip"] = cherrypy.request.headers["X-Forwarded-For"] if "X-Forwarded-For" in cherrypy.request.headers else cherrypy.request.remote.ip
        doc["_form"] = _form
        doc["_time"] = datetime.datetime.now()
        self._db["formdata"].insert(doc)
        return jssuccess()
        
    @cherrypy.expose
    def queryformdata(self,_form=None,**kwargs):
        if _form is not None:
            kwargs["_form"] = _form
        data = list(self._db["formdata"].find(kwargs))
        return jssuccess(data=data)

    @cherrypy.expose
    def lock(self, data):
        return jssuccess()

    @cherrypy.expose
    def unlock(self, data):
        return jssuccess()

    @cherrypy.expose
    def auth(self, data, perm, apikey=None):
        data = loads(data)
        ids = self.valid_ids(perm, apikey)
        if "_id" in data:   # edit operation
            return jssuccess() if data["_id"] in ids else jsdeny()
        # new operation
        if "office" in data:
            return jssuccess() if data["office"] in ids else jsdeny()
        if "institute" in data:
            return jssuccess() if data["institute"] in ids else jsdeny()
        return jsdeny()
        
    def valid_ids(self, perm, apikey=None):
        person = self._db["person"].find_one({
            "apikey": apikey,
            "perms.inst." + perm: {"$exists": True}
        })
        
        if apikey is None or person is None:
            return []
        
        ids = person["perms"]["inst"][perm]
        query = {} if ids is None else {"_id": {"$in": ids}}
        insts = list(self._db["institute"].find(query))
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
        return [o["_id"] for o in insts + offices + persons + decisions + advices]

    def default_perm(self, obj):
        office = self._db["office"].find_one({"_id": obj["office"]})
        obj["perms"] = {
            "inst": {
                "view": [ office["institute"] ],
                "edit": [ office["institute"] ],
            }
        }

    def check_type(self, type):
        return type == "person" or type == "office" or type == "institute" or type == "decision" or type == "advice"

    @cherrypy.expose
    def save(self, data, apikey=None):
        data = loads(data)
        dest = data.get("type")
        ids = self.valid_ids("edit", apikey)
        if ("_id" in data and data["_id"] not in ids) or not self.check_type(dest):
            return jsdeny()
        if "_id" not in data and data.get("office") not in ids and data.get("institute") not in ids:
            return jsdeny()
        obj = self._db[dest].find_one({"_id": data.get("_id")})
        ts = int(time.time())
        data["changed"] = ts
        self.ensure_apikey(data, obj.get("apikey") if obj is not None else None)
        self.remove_custom_hazards(data)
        if obj is None:
            data["created"] = ts
            if dest == 'person':
                self.default_perm(data)
            id = self._db[dest].insert(data)
        else:
            self._db[dest].update({"_id": obj["_id"]}, data)
            id = obj["_id"]
        return jssuccess(id=id)

    def remove_custom_hazards(self, data):
        if data.get("type") != "office":
            return
        default_hazards = self._db["hazard_types"].find_one()
        default_hazards.pop("_id")
        hazard_groups = data.get("hazard_types")
        map = {}
        for k1 in default_hazards:
            map[k1] = {}
            group = hazard_groups.get(k1)
            if group is None:
                map[k1] = default_hazards[k1]
                continue
            for k2 in group:
                hazard = group[k2]
                if hazard or k2 in default_hazards[k1]:
                    map[k1][k2] = hazard
        data["hazard_types"] = map

    @cherrypy.expose
    def load(self, ts, apikey=None):
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

    @cherrypy.expose
    def new(self, role):
        if role == "office":
            office = {}
            ht = self._db["hazard_types"].find_one()
            ht.pop("_id")
            office["hazard_types"] = ht
            return jssuccess(obj=office)
        return jsfail()
    
    @cherrypy.expose
    def invite(self, data, text, apikey=None):            
        if apikey is None or self._db["person"].find_one({"apikey": apikey}) is None:
            return jsdeny()
        data = loads(data)
        # search institute
        obj = {
            "acronym": data["inst_acronym"],
            "name": data["inst_name"]
        }
        inst = self._db["institute"].find_one(obj)
        if inst is None:
            ts = int(time.time())
            obj["created"] = ts
            obj["changed"] = ts
            obj["type"] = "institute";
            #inst = self._db["institute"].insert_one(obj).raw_result
            self._db["institute"].insert(obj)
            inst = self._db["institute"].find_one(obj)
        elif inst["_id"] not in self.valid_ids("edit", apikey):
            return jsdeny()
        # search office
        obj = {
            "name": data["office_name"],
            "institute": inst["_id"]
        }
        office = self._db["office"].find_one(obj)
        if office is None:
            ts = int(time.time())
            obj["created"] = ts
            obj["changed"] = ts
            obj["type"] = "office";
            obj["hazard_types"] = self._db["hazard_types"].find_one()
            obj["hazard_types"].pop("_id")
            #office = self._db["office"].insert_one(obj).raw_result
            self._db["office"].insert(obj)
            office = self._db["office"].find_one(obj)
        # search person
        obj = {
            "name": data["name"],
            "mail": data["mail"],
            "phone": data["phone"],
            "office": office["_id"]
        }
        person = self._db["person"].find_one(obj)
        ts = int(time.time())
        if person is None:
            # TODO: move this to a central place
            obj["created"] = ts
            obj["changed"] = ts
            obj["type"] = "person";
            obj["fax"] = obj["kind"] = ""
            #person = self._db["person"].insert_one(obj).raw_result
            self.ensure_apikey(obj)
            self.default_perm(obj)
            self._db["person"].insert(obj)
            person = self._db["person"].find_one(obj)
            
        # send mails
        res = sendmail(
            data["from"],
            data["mail"],
            "ERCC cooperation with national institutes lawfully mandated to provide warnings and expert advice",
            text % ("http://trideccloud.gfz-potsdam.de/aristotle/inventory.html?" + person["apikey"]),
            data["cc"]
        )
        print(res)
        
        return jssuccess()

    def find_one(self, query, filt={}):
        for dest in ["person", "office", "institute", "decision", "advice"]:
            obj = self._db[dest].find_one(query, filt)
            if obj is not None:
                return obj;
        return None
    
    def find(self, query, filt={}):
        res = []
        for dest in ["person", "office", "institute", "decision", "advice"]:
            res += list(self._db[dest].find(query, filt))
        return res

    def ensure_apikey(self, obj, key=None):
        obj["apikey"] = self.generate_apikey() if key is None else key

    # generates a random key of 32 hexadecimal characters 
    def generate_apikey(self):
        return binascii.b2a_hex(os.urandom(16)).decode("ascii")

application = startapp( AristotleSrv )

