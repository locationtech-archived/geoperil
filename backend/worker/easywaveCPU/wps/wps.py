#!/usr/bin/env python3

import os
import flask

import pywps
from pywps import Service
import pywps.configuration as config

from processes.easywavecpu import EasyWaveCpu


app = flask.Flask(__name__)

processes = [
    EasyWaveCpu()
]

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

    server_url = os.environ.get('SERVER_URL')
    if server_url is not None:
        config.CONFIG.set('server', 'url', server_url)

    output_url = os.environ.get('OUTPUT_URL')
    if output_url is not None:
        config.CONFIG.set('server', 'outputurl', output_url)

    app.run(threaded=True, host='0.0.0.0', debug=development)
