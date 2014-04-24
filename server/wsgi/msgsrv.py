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

logger = logging.getLogger("MsgSrv")

class MsgSrv(Base):

    @cherrypy.expose
    def index(self):
        return "Hello World!" + str(self.getUser())

    @cherrypy.expose
    @cherrypy.tools.allow(methods=['POST'])
    def mail(self, apiver, to, subject, text, cc = "", attachments = []):
        # TODO: propper attachment handling
        user = self.getUser()
        if user is not None and user["permissions"].get("mail",False):
            if apiver == "1":
                warnings = []
                send_from = user["username"]
                send_to = to.replace(","," ").replace(";"," ").split()
                send_cc = cc.replace(","," ").replace(";"," ").split()
                send_subject = str(subject)
                send_text = str(text)
                send_date = formatdate()
                send_msgid = make_msgid()

                dbmsg = {
                    "userid" : user["_id"],
                    "msgid" : send_msgid,
                    "from" : send_from,
                    "to" : send_to,
                    "cc" : send_cc,
                    "date" : send_date,
                    "subject" : send_subject,
                    "text" : send_text,
                }

                self._db["emails"].remove({"msgid":send_msgid})
                self._db["email_recipients"].remove({"msgid":send_msgid})

                self._db["emails"].insert(dbmsg)
                for recv in send_to + send_cc:
                    ruser = self._db["users"].find_one({"username":recv})
                    if ruser is not None:
                        recv = {"userid":ruser["_id"], "recvaddress":recv, "msgid":send_msgid}
                        if self._db["email_recipients"].find_one(recv) is None:
                            recv["read"] = False
                            self._db["email_recipients"].insert(recv)

                msg = MIMEMultipart()
                msg["From"] = send_from
                if len(send_from) > 0:
                    msg["To"] = ", ".join(send_to)
                if len(send_cc) > 0:
                    msg["Cc"] = ", ".join(send_cc)
                msg["Subject"] = send_subject
                msg["Date"] = send_date
                msg["Message-ID"] = send_msgid
                msg.attach(MIMEText(send_text))
                for a in attachments:
                    if a.file:
                        a.file.seek(0)
                        part = MIMEApplication(a.file.readall())
                        part.add_header('Content-Disposition', 'attachment; filename="%s"' % a.filename)
                        msg.attach(part)

                smtp = smtplib.SMTP('cgp1.gfz-potsdam.de')
                errors = None
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
                if success is not None and errors is not None:
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
                return jssuccess(errors = errors) if success else jsfail(errors = errors)
            else:
                return jsfail(errors = ["API version not supported."])
        else:
            return jsdeny()

    @cherrypy.expose
    @cherrypy.tools.allow(methods=['POST'])
    def fax(self, apiver, to, text):
        user = self.getUser()
        if user is not None and user["permissions"].get("fax",False):
            if apiver == "1":
                to = to.replace(",",";").split(";")
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
                self._db["faxes"].insert({"userid": user["_id"], "text": text, "sendfaxes": success, "errors": errors})
                if len(success) > 0:
                    return jssuccess(sendfaxes = success, errors = errors)
                else:
                    return jsfail(errors = errors)
            else:
                return jsfail(errors = ["API version not supported."])
        else:
            return jsdeny()

    @cherrypy.expose
    @cherrypy.tools.allow(methods=['POST'])
    def ftp(self, apiver, text):
        user = self.getUser()
        if user is not None and user["permissions"].get("ftp",False):
            if apiver == "1":
                host = user["properties"].get("FtpHost","")
                port = user["properties"].get("FtpPort",21)
                path = user["properties"].get("FtpPath","")
                username = user["properties"].get("FtpUser","anonymous")
                password = user["properties"].get("FtpPassword","anonymous")
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
                self._db["ftptrans"].insert({"userid": user["_id"], "text": text, "error": error})
                if error is None:
                    return jssuccess()
                else:
                    return jsfail(errors = [error])
            else:
                return jsfail(errors = ["API version not supported."])
        else:
            return jsdeny()

application = startapp( MsgSrv )
