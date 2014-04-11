from base import *
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from email.mime.text import MIMEText
from email.utils import formatdate, make_msgid
import smtplib

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
        if user is None:
            return json.dumps({ "status": "denied" })
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
                if self._db["users"].find_one({"username":recv}) is not None:
                    recv = {"username":recv, "msgid":send_msgid}
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
            try:
                res = smtp.send_message(msg)
                for k,v in res.items():
                    res[k] = (v[0],v[1].decode('utf-8'))
                return json.dumps({"status": "success", "errors": res})
            except smtplib.SMTPRecipientsRefused as ex:
                return json.dumps({"status": "failure", "errors": ex.receipients})
            except smtplib.SMTPSenderRefused as ex:
                return json.dumps({"status": "failure", "errors": str(ex)})
            finally:
                smtp.quit()
        else:
            return json.dumps({ "status": "failure", "errors": ["API version not supported."]})
            

application = startapp( MsgSrv )
