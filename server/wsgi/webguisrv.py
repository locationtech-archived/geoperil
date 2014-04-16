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
        else:
            return jsfail()

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
                return jssuccess()
            else:
                return jsfail(errors = ["User already exists."])
        return jsdeny()

application = startapp( WebGuiSrv )
