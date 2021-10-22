# GeoPeril - A platform for the computation and web-mapping of hazard specific
# geospatial data, as well as for serving functionality to handle, share, and
# communicate threat specific information in a collaborative environment.
#
# Copyright (C) 2021 GFZ German Research Centre for Geosciences
#
# SPDX-License-Identifier: Apache-2.0
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#   http://apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the Licence is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the Licence for the specific language governing permissions and
# limitations under the Licence.
#
# Contributors:
#   Johannes Spazier (GFZ)
#   Sven Reissland (GFZ)
#   Martin Hammitzsch (GFZ)
#   Matthias Rüster (GFZ)
#   Hannes Fuchs (GFZ)

from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formatdate, make_msgid
from xml.etree import ElementTree
import smtplib
import ftplib
import io
import os
import datetime
import copy
import logging
import requests
import cherrypy
from cherrypy.lib.static import serve_file
from basesrv import BaseSrv
from base import jsfail, jsdeny, jssuccess, startapp

logger = logging.getLogger("MsgSrv")


def sendmail(
        send_from,
        send_to,
        send_subject,
        send_text,
        send_cc="",
        send_date=None,
        send_msgid=None
):
    msg = MIMEMultipart()
    msg["From"] = send_from
    if isinstance(send_to, str):
        msg["To"] = send_to
    elif isinstance(send_to, list) and send_to != []:
        msg["To"] = ", ".join(send_to)
    if isinstance(send_cc, str):
        msg["Cc"] = send_cc
    elif isinstance(send_cc, list) and send_cc != []:
        msg["Cc"] = ", ".join(send_cc)
    msg["Subject"] = send_subject
    msg["Date"] = formatdate() if send_date is None else send_date
    msg["Message-ID"] = make_msgid() if send_msgid is None else send_msgid
    msg.attach(MIMEText(send_text, _charset='utf-8'))

    smtp = smtplib.SMTP('cgp1.gfz-potsdam.de')
    errors = []
    success = False
    try:
        res = smtp.send_message(msg)
        for key, val in res.items():
            errors.append((key, (val[0], val[1].decode('utf-8'))))
        success = True
    except smtplib.SMTPRecipientsRefused as ex:
        errors = {}
        for key, val in ex.recipients.items():
            errors.append((key, (val[0], val[1].decode('utf-8'))))
    except smtplib.SMTPSenderRefused as ex:
        errors = [(ex.sender, (ex.smtp_code, str(ex.smtp_error)))]
        success = None
    smtp.quit()
    print("Mail from", msg["From"], "to", msg["To"], success, errors)
    return success, errors


def sendtwilliosms(twisid, twitoken, twifrom, sendto, text):
    if isinstance(sendto, str):
        errors = []
        success = []
        auth = requests.auth.HTTPBasicAuth(twisid, twitoken)
        payload = {}
        payload["To"] = sendto.strip()
        payload["From"] = twifrom
        payload["Body"] = text
        req = requests.post(
            "https://api.twilio.com/2010-04-01/Accounts/%s/Messages" % twisid,
            data=payload,
            auth=auth
        )
        elm = ElementTree.fromstring(req.text)
        exc = elm.find("RestException")
        if exc is None:
            for side in elm.iter("Sid"):
                success.append((sendto, side.text))
                break
        else:
            errors.append(
                (sendto, ElementTree.tostring(exc, encoding='unicode'))
            )
        print(
            "SMS from", payload["From"],
            "to", payload["To"],
            success, errors
        )
        return success, errors
    if isinstance(sendto, list):
        errors = []
        success = []
        for sto in sendto:
            succ, err = sendtwilliosms(twisid, twitoken, twifrom, sto, text)
            errors += err
            success += succ
        return success, errors
    return None, None


class MsgSrv(BaseSrv):
    @cherrypy.expose
    @cherrypy.tools.allow(methods=['POST'])
    def instsms(self, apiver, inst, secret, username, to, text):
        if apiver == "1":
            inst = self._db["institutions"].find_one({
                "name": inst,
                "secret": secret
            })
            if inst is not None and inst.get("instsms", False):
                to = to.replace(",", ";").split(";")
                user = self._db["users"].find_one({
                    "username": username
                })
                twisid = user["properties"].get("TwilioSID", "")
                twitoken = user["properties"].get("TwilioToken", "")
                twifrom = user["properties"].get("TwilioFrom", "")
                success, errors = sendtwilliosms(
                    twisid, twitoken, twifrom, to, text
                )
                if success != []:
                    return jssuccess(sentsmsids=success, errors=errors)
                return jsfail(errors=errors)
            return jsdeny()
        return jsfail(errors=["API version not supported."])

    @cherrypy.expose
    @cherrypy.tools.allow(methods=['POST'])
    def instmail(
            self, apiver, inst, secret,
            fromaddr, toaddr, subject, text, cc=""
    ):
        if apiver == "1":
            inst = self._db["institutions"].find_one({
                "name": inst,
                "secret": secret
            })
            if inst is not None and inst.get("instmail", False):
                toaddr = toaddr.replace(",", " ").replace(";", " ").split()
                cc = cc.replace(",", " ").replace(";", " ").split()
                success, errors = sendmail(fromaddr, toaddr, subject, text, cc)
                if success:
                    return jssuccess(errors=errors)
                return jsfail(errors=errors)
            return jsdeny()
        return jsfail(errors=["API version not supported."])

    @cherrypy.expose
    def readmsg(self, apiver, msgid):
        user = self.getUser()
        if user is not None:
            if apiver == "1":
                self._db["messages_received"].update(
                    {
                        "Message-ID": msgid,
                        "ReadTime": None,
                        "ReceiverID": user["_id"]
                    },
                    {
                        "$set": {"ReadTime": datetime.datetime.utcnow()}
                    }
                )
                msg = self._db["messages_received"].find_one({
                    "Message-ID": msgid,
                    "ReceiverID": user["_id"]
                })
                if msg is None:
                    rtime = None
                else:
                    rtime = msg["ReadTime"].strftime("%b %d, %Y %I:%M:%S %p")
                return jssuccess(readtime=rtime)
            return jsfail(errors=["API version not supported."])
        return jsdeny()

    @cherrypy.expose
    def displaymapmsg(self, apiver, msgid):
        user = self.getUser()
        if user is not None:
            if apiver == "1":
                self._db["messages_received"].update(
                    {
                        "Message-ID": msgid,
                        "MapDisplayTime": None,
                        "ReceiverID": user["_id"]
                    },
                    {
                        "$set": {"MapDisplayTime": datetime.datetime.utcnow()}
                    }
                )
                msg = self._db["messages_received"].find_one({
                    "Message-ID": msgid,
                    "ReceiverID": user["_id"]
                })
                if msg is None:
                    mdtime = None
                else:
                    mdtime = msg["MapDisplayTime"] \
                        .strftime("%b %d, %Y %I:%M:%S %p")
                return jssuccess(mapdisplaytime=mdtime)
            return jsfail(errors=["API version not supported."])
        return jsdeny()

    @cherrypy.expose
    @cherrypy.tools.allow(methods=['POST'])
    def intmsg(
            self, apiver, to, subject, text,
            evid=None, parentid=None, groupID=None, msgnr=None
    ):
        user = self.getUser()
        if user is not None and user["permissions"].get("intmsg", False):
            if apiver == "1":
                dbmsg = {
                    "Type": "INTERNAL",
                    "SenderID": user["_id"],
                    "CreatedTime": datetime.datetime.utcnow(),
                    "EventID": evid,
                    "ParentId": parentid,
                    "Message-ID": make_msgid(),
                    }
                if msgnr is not None:
                    dbmsg["NextMsgNr"] = int(msgnr)
                dbmsg["Text"] = text
                dbmsg["Subject"] = subject
                errors = []
                success = False
                send_to = to.replace(",", " ").replace(";", " ").split()
                for sto in send_to:
                    ruser = self._db["users"].find_one({"username": sto})
                    if ruser is None:
                        errors.append((sto, "Unknown User %s" % sto))
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
                if success:
                    return jssuccess(errors=errors)
                return jsfail(errors=errors)
            return jsfail(errors=["API version not supported."])
        return jsdeny()

    @cherrypy.expose
    @cherrypy.tools.allow(methods=['POST'])
    def mail(
            self, apiver, to, subject, text, cc="",
            evid=None, parentid=None, groupID=None, msgnr=None
    ):
        user = self.getUser()
        if user is not None and user["permissions"].get("mail", False):
            if apiver == "1":
                dbmsg = {
                    "Type": "MAIL",
                    "SenderID": user["_id"],
                    "CreatedTime": datetime.datetime.utcnow(),
                    "EventID": evid,
                    "ParentId": parentid,
                }
                if msgnr is not None:
                    dbmsg["NextMsgNr"] = int(msgnr)
                send_from = user["username"]
                send_to = to.replace(",", " ").replace(";", " ").split()
                send_cc = cc.replace(",", " ").replace(";", " ").split()
                send_subject = str(subject)
                send_text = str(text)
                send_date = formatdate()
                send_msgid = make_msgid()

                dbmsg["From"] = send_from
                if send_to != []:
                    dbmsg["To"] = send_to
                if send_cc != []:
                    dbmsg["Cc"] = send_cc
                dbmsg["Subject"] = send_subject
                dbmsg["Date"] = send_date
                dbmsg["Message-ID"] = send_msgid
                dbmsg["Text"] = send_text

                success, errors = sendmail(
                    send_from, send_to, send_subject,
                    send_text, send_cc, send_date, send_msgid
                )
                if errors != [] and success is not None:
                    errtext = "There were errors while sending your Message.\n"
                    for err in errors:
                        errtext += "\n%s:\t%d: %s" % \
                            (err[0], err[1][0], err[1][1])
                    sendmail(
                        user["username"],
                        user["username"],
                        "Error in mailing system",
                        errtext
                    )

                dbmsg["errors"] = errors
                self._db["messages_sent"].insert(dbmsg)
                msgevt = {
                    "id": dbmsg["Message-ID"],
                    "user": dbmsg["SenderID"],
                    "timestamp": dbmsg["CreatedTime"],
                    "event": "msg_sent",
                }
                self._db["events"].insert(msgevt)

                if success:
                    return jssuccess(errors=errors)
                return jsfail(errors=errors)
            return jsfail(errors=["API version not supported."])
        return jsdeny()

    @cherrypy.expose
    @cherrypy.tools.allow(methods=['POST'])
    def fax(
            self, apiver, to, text,
            evid=None, parentid=None, groupID=None, msgnr=None
    ):
        user = self.getUser()
        if user is not None and user["permissions"].get("fax", False):
            if apiver == "1":
                dbmsg = {
                    "Type": "FAX",
                    "SenderID": user["_id"],
                    "CreatedTime": datetime.datetime.utcnow(),
                    "EventID": evid,
                    "ParentId": parentid,
                    "Message-ID": make_msgid(),
                }
                if msgnr is not None:
                    dbmsg["NextMsgNr"] = int(msgnr)
                to = to.replace(",", ";").split(";")
                dbmsg["To"] = to
                dbmsg["Text"] = text
                errors = []
                success = []
                for fnr in to:
                    payload = {}
                    payload["Username"] = user["properties"] \
                        .get("InterfaxUsername", "")
                    payload["Password"] = user["properties"] \
                        .get("InterfaxPassword", "")
                    payload["FileType"] = "HTML"
                    payload["FaxNumber"] = fnr
                    payload["Data"] = '<html><body><pre style="' + \
                        'font-family: monospace; white-space: pre-wrap; ' + \
                        'word-wrap: break-word;">' + text + \
                        '</pre></body></html>'
                    req = requests.post(
                        "https://ws.interfax.net/dfs.asmx/SendCharFax",
                        data=payload
                    )
                    elm = ElementTree.fromstring(req.text)
                    if int(elm.text) >= 0:
                        success.append((fnr, elm.text))
                    else:
                        errors.append((fnr, elm.text))
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
                if success != []:
                    return jssuccess(sentfaxids=success, errors=errors)
                return jsfail(errors=errors)
            return jsfail(errors=["API version not supported."])
        return jsdeny()

    @cherrypy.expose
    @cherrypy.tools.allow(methods=['POST'])
    def sms(self, apiver, to, text, evid=None, parentid=None, groupID=None):
        user = self.getUser()
        if user is not None and user["permissions"].get("sms", False):
            if apiver == "1":
                dbmsg = {
                    "Type": "SMS",
                    "SenderID": user["_id"],
                    "CreatedTime": datetime.datetime.utcnow(),
                    "EventID": evid,
                    "ParentId": parentid,
                    "Message-ID": make_msgid(),
                }
                to = to.replace(",", ";").split(";")
                dbmsg["To"] = to
                dbmsg["Text"] = text

                twisid = user["properties"].get("TwilioSID", "")
                twitoken = user["properties"].get("TwilioToken", "")
                twifrom = user["properties"].get("TwilioFrom", "")
                success, errors = sendtwilliosms(
                    twisid, twitoken, twifrom, to, text
                )

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
                if success != []:
                    return jssuccess(sentsmsids=success, errors=errors)
                return jsfail(errors=errors)
            return jsfail(errors=["API version not supported."])
        return jsdeny()

    @cherrypy.expose
    @cherrypy.tools.allow(methods=['POST'])
    def ftp(
            self, apiver, fname, text,
            evid=None, parentid=None, groupID=None, msgnr=None
    ):
        user = self.getUser()
        if user is not None and user["permissions"].get("ftp", False) and \
                fname is not None and fname != "":
            if apiver == "1":
                dbmsg = {
                    "Type": "FTP",
                    "SenderID": user["_id"],
                    "CreatedTime": datetime.datetime.utcnow(),
                    "EventID": evid,
                    "ParentId": parentid,
                    "Message-ID": make_msgid(),
                }
                if msgnr is not None:
                    dbmsg["NextMsgNr"] = int(msgnr)
                host = user["properties"].get("FtpHost", "")
                port = user["properties"].get("FtpPort", 21)
                path = user["properties"].get("FtpPath", "") + "/" + fname
                username = user["properties"].get("FtpUser", "anonymous")
                password = user["properties"].get("FtpPassword", "anonymous")
                dbmsg["To"] = ["%s@%s:%d%s" % (username, host, port, path)]
                dbmsg["Text"] = text
                error = None
                try:
                    ftp = ftplib.FTP()
                    ftp.connect(host, port)
                    ftp.login(username, password)
                    ftp.set_pasv(True)
                    path = os.path.normpath(path)
                    ftp.cwd(os.path.dirname(path))
                    ftp.storbinary(
                        "STOR %s" % os.path.basename(path),
                        io.BytesIO(bytes(text, "utf-8"))
                    )
                    ftp.quit()
                except ftplib.all_errors as err:
                    error = str(err)
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
                return jsfail(errors=[error])
            return jsfail(errors=["API version not supported."])
        return jsdeny()


application = startapp(MsgSrv)
