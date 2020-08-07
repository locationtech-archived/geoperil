#!/bin/bash

GEOFON_LAST300_URL="${GEOFON_LIST_URL}?fmt=geojson&nmax=300"
export GEOFON_OUTPUT="geofon-last300.geojson"

cd `dirname $0`

trap "rm -f running.lock" EXIT

while true; do
    if [ ! -e running.lock ]; then
        echo $$ > running.lock
        rm "${GEOFON_OUTPUT}" || true
        wget "${GEOFON_LAST300_URL}" -O "${GEOFON_OUTPUT}"
        python3 manager.py 2>&1 | tee -a "db-manager.log"
        rm -f running.lock
    fi

    sleep 120
done
