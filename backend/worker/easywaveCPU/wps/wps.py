#!/usr/bin/env python3

import os
import flask

import pywps
from pywps import Service

from processes.echo import Echo
from processes.sleepecho import SleepEcho
from processes.easywavecpu import EasyWaveCpu


app = flask.Flask(__name__)

processes = [
    Echo(),
    SleepEcho(),
    EasyWaveCpu()
]

# For the process list on the home page
process_descriptor = {}
for process in processes:
    abstract = process.abstract
    identifier = process.identifier
    process_descriptor[identifier] = abstract

# This is, how you start PyWPS instance
service = Service(processes, ['pywps.cfg'])


@app.route("/")
def index():
    server_url = pywps.configuration.get_config_value("server", "url")
    return flask.render_template(
        'index.html',
        server_url=server_url
    )


@app.route('/wps', methods=['GET', 'POST'])
def wps():
    return service


@app.route('/outputs/' + '<path:filename>')
def outputfile(filename):
    targetfile = os.path.join('outputs', filename)
    if os.path.isfile(targetfile):
        file_ext = os.path.splitext(targetfile)[1]
        with open(targetfile, mode='rb') as f:
            file_bytes = f.read()
        mime_type = None
        if 'xml' in file_ext:
            mime_type = 'text/xml'
        return flask.Response(file_bytes, content_type=mime_type)
    else:
        flask.abort(404)


if __name__ == "__main__":
    # start with a clean logging backend DB
    # since queued requests will not be continued after a restart
    tempsqlite = os.path.join('logs', 'pywps-logs.sqlite3')
    if os.path.isfile(tempsqlite):
        os.unlink(tempsqlite)

    development = False
    if os.environ.get('DEVELOPMENT') is not None:
        development = True

    app.run(threaded=True, host='0.0.0.0', debug=development)
