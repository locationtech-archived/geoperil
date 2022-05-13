#!/bin/bash

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

# save environment variables for cron job
# https://stackoverflow.com/a/48651061/2249798
declare -p | grep -Ev 'BASHOPTS|BASH_VERSINFO|EUID|PPID|SHELLOPTS|UID' > /container.env

service rsyslog start
service cron start

GEOFON_LAST300_URL="${GEOFON_LIST_URL}?fmt=geojson&nmax=300"
export GEOFON_OUTPUT="geofon-last300.geojson"

LOGFILE="db-manager.log"

cd `dirname $0`
touch "${LOGFILE}"

trap "rm -f running.lock" EXIT

while true; do
    if [ ! -e running.lock ]; then
        echo $$ > running.lock
        if [ "$(du -s ${LOGFILE} | cut -f1)" -gt 100000 ] ; then
            mv "${LOGFILE}" "${LOGFILE}.old"
            touch "${LOGFILE}"
        fi
        rm "${GEOFON_OUTPUT}" || true
        wget "${GEOFON_LAST300_URL}" -O "${GEOFON_OUTPUT}"
        python3 manager.py 2>&1 | tee -a "${LOGFILE}" && rm -f running.lock &
    fi

    sleep 20
done
