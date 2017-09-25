'''
   GeoPeril - A platform for the computation and web-mapping of hazard specific
   geospatial data, as well as for serving functionality to handle, share, and
   communicate threat specific information in a collaborative environment.
   
   Copyright (C) 2013 GFZ German Research Centre for Geosciences
   
   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at
   
     http://apache.org/licenses/LICENSE-2.0
   
   Unless required by applicable law or agreed to in writing, software
   distributed under the Licence is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the Licence for the specific language governing permissions and
   limitations under the Licence.
   
   Contributors:
   Johannes Spazier (GFZ) - initial implementation
   Sven Reissland (GFZ) - initial implementation
   Martin Hammitzsch (GFZ) - initial implementation
'''

from basesrv import *
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from email.mime.text import MIMEText
from email.utils import formatdate, make_msgid
import smtplib
import requests
from xml.etree import ElementTree
import ftplib
import io
import datetime
import copy

logger = logging.getLogger("MsgSrv")

def sendmail(send_from, send_to, send_subject, send_text, send_cc = "", send_date = None, send_msgid = None):
    msg = MIMEMultipart()
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
    print("Mail from", msg["From"], "to", msg["To"], success, errors)
    return success,errors

def sendtwilliosms(twisid, twitoken, twifrom, to, text):
    if type(to) == str:
        errors = []
        success = []
        auth = requests.auth.HTTPBasicAuth( twisid, twitoken )
        payload = {}
        payload["To"] = to.strip()
        payload["From"] = twifrom
        payload["Body"] = text
        r = requests.post("https://api.twilio.com/2010-04-01/Accounts/%s/Messages" % twisid, data=payload, auth=auth)
        e = ElementTree.fromstring(r.text)
        ex = e.find("RestException")
        if ex is None:
            for side in e.iter("Sid"):
                success.append( (to, side.text) )
                break
        else:
            errors.append( (to, ElementTree.tostring(ex,encoding='unicode')) )
        print("SMS from", payload["From"], "to", payload["To"], success, errors)
        return success, errors
    elif type(to) == list:
        errors = []
        success = []
        for nr in to:
            succ, err = sendtwilliosms(twisid, twitoken, twifrom, nr, text)
            errors += err
            success += succ
        return success, errors

class MsgSrv(BaseSrv):

    @cherrypy.expose
    @cherrypy.tools.allow(methods=['POST'])
    def instsms(self, apiver, inst, secret, username, to, text):
        if apiver == "1":
            inst = self._db["institutions"].find_one({"name":inst, "secret": secret})
            if inst is not None and inst.get("instsms",False):
                to = to.replace(",",";").split(";")
                user = self._db["users"].find_one({"username":username})
                twisid = user["properties"].get("TwilioSID","")
                twitoken = user["properties"].get("TwilioToken","")
                twifrom = user["properties"].get("TwilioFrom","")
                success, errors = sendtwilliosms(twisid, twitoken, twifrom, to, text)
                if len(success) > 0:
                    return jssuccess(sentsmsids = success, errors = errors)
                else:
                    return jsfail(errors = errors)
            return jsdeny()
        else:
            return jsfail(errors = ["API version not supported."])

    @cherrypy.expose
    @cherrypy.tools.allow(methods=['POST'])
    def instmail(self, apiver, inst, secret, fromaddr, toaddr, subject, text, cc = ""):
        if apiver == "1":
            inst = self._db["institutions"].find_one({"name":inst, "secret": secret})
            if inst is not None and inst.get("instmail",False):
                toaddr = toaddr.replace(","," ").replace(";"," ").split()
                cc = cc.replace(","," ").replace(";"," ").split()
                success, errors = sendmail(fromaddr, toaddr, subject, text, cc)
                return jssuccess(errors = errors) if success else jsfail(errors = errors)
            return jsdeny()
        else:
            return jsfail(errors = ["API version not supported."])

    @cherrypy.expose
    def readmsg(self, apiver, msgid ):
        user = self.getUser()
        if user is not None:
            if apiver == "1":
                self._db["messages_received"].update({"Message-ID": msgid, "ReadTime": None, "ReceiverID": user["_id"]}, \
                                                     {"$set":{"ReadTime": datetime.datetime.utcnow()}})
                msg = self._db["messages_received"].find_one({"Message-ID": msgid, "ReceiverID": user["_id"]})
                return jssuccess(readtime = None if msg is None else msg["ReadTime"].strftime( "%b %d, %Y %I:%M:%S %p" ))
            else:
                return jsfail(errors = ["API version not supported."])
        else:
            return jsdeny()

    @cherrypy.expose
    def displaymapmsg(self, apiver, msgid ):
        user = self.getUser()
        if user is not None:
            if apiver == "1":
                self._db["messages_received"].update({"Message-ID": msgid, "MapDisplayTime": None, "ReceiverID": user["_id"]}, \
                                                     {"$set":{"MapDisplayTime": datetime.datetime.utcnow()}})
                msg = self._db["messages_received"].find_one({"Message-ID": msgid, "ReceiverID": user["_id"]})
                return jssuccess(mapdisplaytime = None if msg is None else msg["MapDisplayTime"].strftime( "%b %d, %Y %I:%M:%S %p" ))
            else:
                return jsfail(errors = ["API version not supported."])
        else:
            return jsdeny()

    @cherrypy.expose
    @cherrypy.tools.allow(methods=['POST'])
    def intmsg(self, apiver, to, subject, text, evid = None, parentid = None, groupID = None, msgnr = None ):
        user = self.getUser()
        if user is not None and user["permissions"].get("intmsg",False):
            if apiver == "1":
                dbmsg = {
                    "Type": "INTERNAL",
                    "SenderID": user["_id"], 
                    "CreatedTime": datetime.datetime.utcnow(),
                    "EventID": evid,
                    "ParentId": parentid,
                    "Message-ID": make_msgid(),
                    }
                if msgnr != None:
                    dbmsg["NextMsgNr"] = int(msgnr)
                dbmsg["Text"] = text
                dbmsg["Subject"] = subject
                errors = []
                success = False
                send_to = to.replace(","," ").replace(";"," ").split()
                for to in send_to:
                    ruser = self._db["users"].find_one({"username":to})
                    if ruser is None:
                        errors.append( (to, "Unknown User %s" % to) )
                    else:
                        success = True
                        rmsg = copy.deepcopy(dbmsg)
                        rmsg["ReceiverID"] = ruser["_id"]
                        rmsg["ReadTime"] = None
                        rmsg["MapDisplayTime"] = None
                        self._db["messages_received"].insert(rmsg)
                        msgevt2 = {
                            "id": rmsg["Message-ID"],
                            "user": rmsg["ReceiverID"],
                            "timestamp": dbmsg["CreatedTime"],
                            "event": "msg_recv",
                            }
                        self._db["events"].insert(msgevt2)
                dbmsg["To"] = send_to
                dbmsg["errors"] = errors
                self._db["messages_sent"].insert(dbmsg)
                msgevt = {
                    "id": dbmsg["Message-ID"],
                    "user": dbmsg["SenderID"],
                    "timestamp": dbmsg["CreatedTime"],
                    "event": "msg_sent",
                    }
                self._db["events"].insert(msgevt)
                return jssuccess(errors = errors) if success else jsfail(errors = errors)
            else:
                return jsfail(errors = ["API version not supported."])
        else:
            return jsdeny()

    @cherrypy.expose
    @cherrypy.tools.allow(methods=['POST'])
    def mail(self, apiver, to, subject, text, cc = "", evid = None, parentid = None, groupID = None, msgnr = None ):
        user = self.getUser()
        if user is not None and user["permissions"].get("mail",False):
            if apiver == "1":
                dbmsg={
                    "Type": "MAIL",
                    "SenderID": user["_id"], 
                    "CreatedTime": datetime.datetime.utcnow(),
                    "EventID": evid,
                    "ParentId": parentid,
                    }
                if msgnr != None:
                    dbmsg["NextMsgNr"] = int(msgnr)
                send_from = user["username"]
                send_to = to.replace(","," ").replace(";"," ").split()
                send_cc = cc.replace(","," ").replace(";"," ").split()
                send_subject = str(subject)
                send_text = str(text)
                send_date = formatdate()
                send_msgid = make_msgid()

                dbmsg["From"] = send_from
                if len(send_to) > 0:
                    dbmsg["To"] = send_to
                if len(send_cc) > 0:
                    dbmsg["Cc"] = send_cc
                dbmsg["Subject"] = send_subject
                dbmsg["Date"] = send_date
                dbmsg["Message-ID"] = send_msgid
                dbmsg["Text"] = send_text

                success, errors = sendmail(send_from, send_to, send_subject, send_text, send_cc, send_date, send_msgid)
                if len(errors) > 0 and success is not None:
                    errtext = "There were errors while sending your Message.\n"
                    for v in errors:
                        errtext+="\n%s:\t%d: %s" % (v[0],v[1][0],v[1][1])
                    sendmail(user["username"], user["username"], "Error in Tridec Cloud Mailing System", errtext)

                dbmsg["errors"] = errors
                self._db["messages_sent"].insert(dbmsg)
                msgevt = {
                    "id": dbmsg["Message-ID"],
                    "user": dbmsg["SenderID"],
                    "timestamp": dbmsg["CreatedTime"],
                    "event": "msg_sent",
                    }
                self._db["events"].insert(msgevt)

                return jssuccess(errors = errors) if success else jsfail(errors = errors)
            else:
                return jsfail(errors = ["API version not supported."])
        else:
            return jsdeny()

    @cherrypy.expose
    @cherrypy.tools.allow(methods=['POST'])
    def fax(self, apiver, to, text, evid = None, parentid = None, groupID = None, msgnr = None ):
        user = self.getUser()
        if user is not None and user["permissions"].get("fax",False):
            if apiver == "1":
                dbmsg={
                    "Type": "FAX",
                    "SenderID": user["_id"], 
                    "CreatedTime": datetime.datetime.utcnow(),
                    "EventID": evid,
                    "ParentId": parentid,
                    "Message-ID": make_msgid(),
                    }
                if msgnr != None:
                    dbmsg["NextMsgNr"] = int(msgnr)
                to = to.replace(",",";").split(";")
                dbmsg["To"] = to
                dbmsg["Text"] = text
                errors = []
                success = []
                for nr in to:
                    payload = {}
                    payload["Username"] = user["properties"].get("InterfaxUsername","")
                    payload["Password"] = user["properties"].get("InterfaxPassword","")
                    payload["FileType"] = "HTML"
                    payload["FaxNumber"] = nr
                    #payload["Data"] = '<html><body><span style="font-family: monospace; white-space: pre;">' + text + '</span></body></html>'
                    payload["Data"] = '<html><body><pre style="font-family: monospace; white-space: pre-wrap; word-wrap: break-word;">' + text + '</pre></body></html>'
                    r = requests.post("https://ws.interfax.net/dfs.asmx/SendCharFax", data=payload)
                    e = ElementTree.fromstring(r.text)
                    if int(e.text) >= 0:
                        success.append( (nr, e.text) )
                    else:
                        errors.append( (nr, e.text) )
                dbmsg["errors"] = errors
                dbmsg["sentfaxids"] = success
                self._db["messages_sent"].insert(dbmsg)
                msgevt = {
                    "id": dbmsg["Message-ID"],
                    "user": dbmsg["SenderID"],
                    "timestamp": dbmsg["CreatedTime"],
                    "event": "msg_sent",
                    }
                self._db["events"].insert(msgevt)
                if len(success) > 0:
                    return jssuccess(sentfaxids = success, errors = errors)
                else:
                    return jsfail(errors = errors)
            else:
                return jsfail(errors = ["API version not supported."])
        else:
            return jsdeny()

    @cherrypy.expose
    @cherrypy.tools.allow(methods=['POST'])
    def sms(self, apiver, to, text, evid = None, parentid = None, groupID = None ):
        user = self.getUser()
        if user is not None and user["permissions"].get("sms",False):
            if apiver == "1":
                dbmsg={
                    "Type": "SMS",
                    "SenderID": user["_id"], 
                    "CreatedTime": datetime.datetime.utcnow(),
                    "EventID": evid,
                    "ParentId": parentid,
                    "Message-ID": make_msgid(),
                    }
                to = to.replace(",",";").split(";")
                dbmsg["To"] = to
                dbmsg["Text"] = text

                twisid = user["properties"].get("TwilioSID","")
                twitoken = user["properties"].get("TwilioToken","")
                twifrom = user["properties"].get("TwilioFrom","")
                success, errors = sendtwilliosms(twisid, twitoken, twifrom, to, text)

                dbmsg["sentsmsids"] = success
                dbmsg["errors"] = errors
                self._db["messages_sent"].insert(dbmsg)
                msgevt = {
                    "id": dbmsg["Message-ID"],
                    "user": dbmsg["SenderID"],
                    "timestamp": dbmsg["CreatedTime"],
                    "event": "msg_sent",
                    }
                self._db["events"].insert(msgevt)
                if len(success) > 0:
                    return jssuccess(sentsmsids = success, errors = errors)
                else:
                    return jsfail(errors = errors)
            else:
                return jsfail(errors = ["API version not supported."])
        else:
            return jsdeny()

    @cherrypy.expose
    @cherrypy.tools.allow(methods=['POST'])
    def ftp(self, apiver, fname, text, evid = None, parentid = None, groupID = None, msgnr = None ):
        user = self.getUser()
        if user is not None and user["permissions"].get("ftp",False) and fname != None and fname != "":
            if apiver == "1":
                dbmsg={
                    "Type": "FTP",
                    "SenderID": user["_id"], 
                    "CreatedTime": datetime.datetime.utcnow(),
                    "EventID": evid,
                    "ParentId": parentid,
                    "Message-ID": make_msgid(),
                    }
                if msgnr != None:
                    dbmsg["NextMsgNr"] = int(msgnr)
                host = user["properties"].get("FtpHost","")
                port = user["properties"].get("FtpPort",21)
                path = user["properties"].get("FtpPath","") + "/" + fname
                username = user["properties"].get("FtpUser","anonymous")
                password = user["properties"].get("FtpPassword","anonymous")
                dbmsg["To"] = [ "%s@%s:%d%s" % (username,host,port,path) ]
                dbmsg["Text"] = text
                error = None
                try:
                    ftp = ftplib.FTP()
                    ftp.connect(host,port)
                    ftp.login(username,password)
                    ftp.set_pasv(True)
                    path = os.path.normpath(path)
                    ftp.cwd(os.path.dirname(path))
                    ftp.storbinary("STOR %s" % os.path.basename(path),io.BytesIO(bytes(text,"utf-8")))
                    ftp.quit()
                except ftplib.all_errors as e:
                    error = str(e)
                dbmsg["errors"] = error
                self._db["messages_sent"].insert(dbmsg)
                msgevt = {
                    "id": dbmsg["Message-ID"],
                    "user": dbmsg["SenderID"],
                    "timestamp": dbmsg["CreatedTime"],
                    "event": "msg_sent",
                    }
                self._db["events"].insert(msgevt)
                if error is None:
                    return jssuccess()
                else:
                    return jsfail(errors = [error])
            else:
                return jsfail(errors = ["API version not supported."])
        else:
            return jsdeny()

application = startapp( MsgSrv )
