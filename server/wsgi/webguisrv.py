from base import *

logger = logging.getLogger("MsgSrv")

def checkpassword(password,pwsalt,pwhash):
    return pwhash == b64encode(hashlib.new("SHA-256",pwsalt + ":" + password)).decode("ascii")
    
def createsaltpwhash(password):
    salt = b64encode(os.urandom(8)).decode("ascii")
    pwhash = b64encode(hashlib.new("sha256",bytes(salt + ":" + password,"utf-8")).digest()).decode("ascii")
    return salt, pwhash

class WebGuiSrv(Base):

    @cherrypy.expose
    def index(self):
        return "Hello World!" + str(self.getUser())

        
            
    @cherrypy.expose
    @cherrypy.tools.allow(methods=['POST'])
    def register(self, username, password, inst = None):
        user = self.getUser()
        if user is not None and user.get("admin",False):
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
                    "admin": False,
                }
                if inst is not None and self._db["institutions"].find_one({"id":inst}) is None:
                    self._db["institutions"].insert({"id":inst, "name":inst, "secret":None})
                self._db["users"].insert(newuser)
                return json.dumps({"status":"success"})
            else:
                return json.dumps({"status":"failed", "errors":["User already exists."]})
        return json.dumps({"status":"denied"})

application = startapp( WebGuiSrv )
