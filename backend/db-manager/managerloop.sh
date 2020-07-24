#!/bin/bash

GEOFON_URL="http://geofon.gfz-potsdam.de/eqinfo/list.php?fmt=geojson&nmax=500"
GEOFON_OUTPUT="geofon-last500.geojson"

cd `dirname $0`

trap "rm -f running.lock && ${GEOFON_OUTPUT}" EXIT

while true; do
    if [ ! -e running.lock ]; then
        echo $$ > running.lock
        rm "${GEOFON_OUTPUT}" || true
        wget "${GEOFON_URL}" -O "${GEOFON_OUTPUT}"
        python3 manager.py 2>&1 | tee -a "db-manager.log"
        rm -f running.lock
    fi

    sleep 120
done
