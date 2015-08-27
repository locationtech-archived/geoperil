from basesrv import *
import time
jsonlib = json

logger = logging.getLogger("DataSrv")

class DataSrv(BaseSrv):

    @cherrypy.expose

application = startapp( FeederSrv )
