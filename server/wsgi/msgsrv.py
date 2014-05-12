from base import *
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

class MsgSrv(Base):

    @cherrypy.expose
    def index(self):
        return "Hello World!" + str(self.getUser())

    @cherrypy.expose
    def readmsg(self, apiver, msgid ):
        user = self.getUser()
        if user is not None:
            if apiver == "1":
                msg = self._db["messages_received"].update({"Message-ID": msgid, "ReadTime": None}, \
                                                           {"$set":{"ReadTime": datetime.datetime.utcnow()}})
                return jssuccess()
            else:
                return jsfail(errors = ["API version not supported."])
        else:
            return jsdeny()

    @cherrypy.expose
    @cherrypy.tools.allow(methods=['POST'])
    def intmsg(self, apiver, to, subject, text, evid = None, parentid = None, groupID = None ):
        user = self.getUser()
        if user is not None:
            if apiver == "1":
                dbmsg = {
                    "Type": "INTERNAL",
                    "SenderID": user["_id"], 
                    "CreatedTime": datetime.datetime.utcnow(),
                    "EventID": evid,
                    "ParentId": parentid,
                    "Message-ID": make_msgid(),
                    }
                dbmsg["Text"] = text
                dbmsg["Subject"] = subject
                errors = {}
                success = False
                send_to = to.replace(","," ").replace(";"," ").split()
                for to in send_to:
                    ruser = self._db["users"].find_one({"username":to})
                    if ruser is None:
                        errors[to] = "Unknown User %s" % to
                    else:
                        success = True
                        rmsg = copy.deepcopy(dbmsg)
                        rmsg["ReceiverID"] = ruser["_id"]
                        rmsg["ReadTime"] = None
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
    def mail(self, apiver, to, subject, text, cc = "", attachments = [], evid = None, parentid = None, groupID = None ):
        # TODO: propper attachment handling testing
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
                warnings = []
                send_from = user["username"]
                send_to = to.replace(","," ").replace(";"," ").split()
                send_cc = cc.replace(","," ").replace(";"," ").split()
                send_subject = str(subject)
                send_text = str(text)
                send_date = formatdate()
                send_msgid = make_msgid()

                msg = MIMEMultipart()
                msg["From"] = send_from
                dbmsg["From"] = send_from
                if len(send_to) > 0:
                    msg["To"] = ", ".join(send_to)
                    dbmsg["To"] = send_to
                if len(send_cc) > 0:
                    msg["Cc"] = ", ".join(send_cc)
                    dbmsg["Cc"] = send_cc
                msg["Subject"] = send_subject
                dbmsg["Subject"] = send_subject
                msg["Date"] = send_date
                dbmsg["Date"] = send_date
                msg["Message-ID"] = send_msgid
                dbmsg["Message-ID"] = send_msgid
                msg.attach(MIMEText(send_text))
                dbmsg["Text"] = send_text
                dbmsg["Attachments"] = {}
                for a in attachments:
                    if a.file:
                        a.file.seek(0)
                        cnt = a.file.readall()
                        part = MIMEApplication(cnt)
                        part.add_header('Content-Disposition', 'attachment; filename="%s"' % a.filename)
                        msg.attach(part)
                        dbmsg["attachments"][a.filename] = cnt

                smtp = smtplib.SMTP('cgp1.gfz-potsdam.de')
                errors = {}
                success = False
                try:
                    res = smtp.send_message(msg)
                    for k,v in res.items():
                        res[k] = (v[0],v[1].decode('utf-8'))
                    success = True
                    errors = res
                except smtplib.SMTPRecipientsRefused as ex:
                    errors = {}
                    for k,v in ex.receipients.items():
                        errors[k] = (v[0],v[1].decode('utf-8'))
                except smtplib.SMTPSenderRefused as ex:
                    errors = {ex.sender: (ex.smtp_code,str(ex.smtp_error))}
                    success = None
                if len(errors) > 0 and success is not None:
                    errtext = "There were errors while sending your Message.\n"
                    for k,v in errors.items():
                        errtext+="\n%s:\t%d: %s" % (k,v[0],v[1])
                    errmsg = MIMEMultipart()
                    errmsg["From"] = user["username"]
                    errmsg["To"] = user["username"]
                    errmsg["Date"] = formatdate()
                    errmsg["Subject"] = "Error in Tridec Cloud Mailing System"
                    errmsg.attach(MIMEText(errtext))
                    smtp.send_message(errmsg)
                smtp.quit()

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
    def fax(self, apiver, to, text, evid = None, parentid = None, groupID = None ):
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
                to = to.replace(",",";").split(";")
                dbmsg["To"] = to
                dbmsg["Text"] = text
                errors = {}
                success = {}
                for nr in to:
                    payload = {}
                    payload["Username"] = user["properties"].get("InterfaxUsername","")
                    payload["Password"] = user["properties"].get("InterfaxPassword","")
                    payload["FileType"] = "TXT"
                    payload["FaxNumber"] = nr
                    payload["Data"] = text
                    r = requests.post("https://ws.interfax.net/dfs.asmx/SendCharFax", data=payload)
                    e = ElementTree.fromstring(r.text)
                    if int(e.text) >= 0:
                        success[nr] = e.text
                    else:
                        errors[nr] = e.text
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
                errors = {}
                success = {}
                twisid = user["properties"].get("TwilioSID","")
                twitoken = user["properties"].get("TwilioToken","")
                twifrom = user["properties"].get("TwilioFrom","")
                auth = requests.auth.HTTPBasicAuth( twisid, twitoken )
                for nr in to:
                    payload = {}
                    payload["To"] = nr
                    payload["From"] = twifrom
                    payload["Body"] = text
                    r = requests.post("https://api.twilio.com/2010-04-01/Accounts/%s/Messages" % twisid, data=payload, auth=auth)
                    e = ElementTree.fromstring(r.text)
                    ex = e.find("RestException")
                    if ex is None:
                        for side in e.iter("Sid"):
                            success[nr] = side.text
                            break
                    else:
                        errors[nr] = ElementTree.tostring(ex,encoding='unicode')
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
    def ftp(self, apiver, text, evid = None, parentid = None, groupID = None ):
        user = self.getUser()
        if user is not None and user["permissions"].get("ftp",False):
            if apiver == "1":
                dbmsg={
                    "Type": "FTP",
                    "SenderID": user["_id"], 
                    "CreatedTime": datetime.datetime.utcnow(),
                    "EventID": evid,
                    "ParentId": parentid,
                    "Message-ID": make_msgid(),
                    }
                host = user["properties"].get("FtpHost","")
                port = user["properties"].get("FtpPort",21)
                path = user["properties"].get("FtpPath","")
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
