from base import *

logger = logging.getLogger("WorkerSrv")

class WorkerSrv(Base):
    def __init__(self,db):
        Base.__init__(self,db)
        self._db["workers"].ensure_index("workerid",unique=True)
        self._db["tasks"].ensure_index("taskid",unique=True)

    @cherrypy.expose
    def register(self,inst,secret,workerid,name,priority,providedsims):
        inst = self._db["institutions"].find_one({"name":inst, "secret": secret})
        if inst is not None:
            w = self._db["workers"].find_one({"workerid":workerid})
            if w is None:
                worker = {
                    "workerid":workerid,
                    "inst":inst["name"],
                    "name":name,
                    "priority":priority,
                    "providedsims":providedsims if type(providedsims) == list else list(providedsims),
                    "state":"offline",
                    "lastcontact":time.time(),
                    "task":None,
                    "progress":None,
                }
                self._db["workers"].insert(worker)
                return jssuccess()
            return jsfail()
        return jsdeny()

    @cherrypy.expose
    def waitforwork(self,workerid):
        worker = self._db["workers"].find_one({"workerid":workerid})
        if worker is None:
            return jsdeny()

        self._db["workers"].update({"workerid":workerid},{"$set":{"lastcontact":time.time()}})

        def handler(self,workerid):
            while True:
                task = self._db["tasks"].find_and_modify(
                    {"state":"queued"}, update={"$set":{"state":"pending"}}, sort=[("created",1)], new=True 
                )
                if task is not None:
                    worker = self._db["workers"].find_and_modify( 
                        {"state":"idle",{"providessimtypes":{"$all":[task["simtype"]]}}},
                        update={"$set":{"state":"chosen","task":task["taskid"]}}, sort=[("priority":1)]
                    )
                    if worker is None:
                        self._db["tasks"].update({"_id":task["_id"]},{"$set":{"state":"queued"}})

                worker = self._db["workers"].find_one({"workerid":workerid})
                if worker is not None and worker["task"] is not None:
                    return bytes(json.dumps({"taskid":worker["task"]},cls=JSONEncoder),"utf-8")
                else:
                    yield("\n")
                    self._db["workers"].update({"workerid":workerid},{"$set":{"lastcontact":time.time()}})
                    time.sleep(1)

        return handler(self,workerid)
    waitforwork._cp_config = {'response.stream': True}

    @cherrypy.expose
    def setstate(self,workerid,state,progress=None,task=None):
        worker = self._db["workers"].find_one({"workerid":workerid})
        if worker is not None:
            self._db["workers"].update({"workerid":workerid},
                {"$set":{"state":state,"progress":progress,"task":task,"lastcontact":time.time()}})
            return jssuccess()
        return jsdeny()

application = startapp( WorkerSrv )
