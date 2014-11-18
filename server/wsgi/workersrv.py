from base import *

logger = logging.getLogger("MsgSrv")

class WorkerSrv(Base):

    @cherrypy.expose
    def register(self,uuid,slots):
        w = self._db["workers"].find_one({"uuid":uuid})
        if w is None:
            self._db["workers"].insert({"uuid":uuid, "slots":([{}] * slots)})
            return jssuccess()
        return jsfail()

    @cherrypy.expose
    def updateinfo(self,uuid,slot,info):
        slot = int(slot)
        w = self._db["workers"].find_one({"uuid":uuid})
        if w is not None:
            if slot < len(w["slots"]):
                self._db["workers"].update({"uuid":uuid},{"$set":{("slots.%d.info" % slot):info}})
                return jssuccess()
        return jsfail()

    

application = startapp( WorkerSrv )
