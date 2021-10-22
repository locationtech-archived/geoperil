#!/usr/bin/env python3

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

import os
import logging
import json
import subprocess
import cherrypy
from base import startapp, jssuccess, jsfail, config

logger = logging.getLogger("GmtSrv")


class GmtSrv:
    def reportbin(self):
        if "report_bin" in config["GMT"]:
            return config["GMT"]["report_bin"]
        return None

    @cherrypy.expose
    def gmt_valid_params(self):
        output = subprocess.check_output(
            [self.reportbin(), "--print_json", "Y"]
        ).decode("utf-8")
        ret = json.loads(output)
        return jssuccess(params=ret)

    @cherrypy.expose
    @cherrypy.tools.allow(methods=['POST'])
    def exec_gmt(self, **params):
        respjson = json.loads(self.gmt_valid_params())
        valid_args = respjson["params"]
        valid_args = [x["Flag2"].lstrip("-") for x in valid_args]

        args = [config["GMT"]["report_bin"]]

        for key, val in params.items():
            if key in valid_args and isinstance(val, str):
                args.append("--" + key)
                args.append(val)
            else:
                logger.warning(
                    "Removing invalid gmt-argument: --%s %s" % (key, str(val))
                )

        logger.info("Executing: %s" % (" ".join(args)))

        proc = subprocess.Popen(
            args,
            cwd=os.path.dirname(config["GMT"]["report_bin"]),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT
        )
        out, _ = proc.communicate()

        if proc.returncode != 0:
            logger.error("Error while executing %s" % (" ".join(args)))
            logger.error(out.decode("utf-8"))
            return jsfail(returncode=proc.returncode)

        return jssuccess(returncode=proc.returncode, output=str(out))


application = startapp(GmtSrv)
