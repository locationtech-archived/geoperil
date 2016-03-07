#!/usr/bin/env python3
from base import *

class BaseSrv:
    INFO = ""
    def __init__(self,db):
        self._db = db

    @cherrypy.expose
    def index(self):
        s = ""
        for n in dir(self):
            if n not in ["index","default"]:
                m = self.__getattribute__(n)
                if inspect.ismethod(m) and hasattr(m,"exposed") and m.exposed:
                    spec = inspect.getfullargspec(m)
                    s += "<li><b>%s</b> %s<br>" % (n, inspect.formatargspec(*spec))
        return "<html><ul>%s</ul>%s</html>" % (s,self.INFO)
