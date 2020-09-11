#!/bin/bash

PYFILE="eventfeeder.py"
LOGFILE="eventfeeder.log"

cd `dirname $0`

trap "rm -f running.lock" EXIT

while true; do
    if [ ! -e running.lock ]; then
        echo $$ > running.lock
        echo "Started feeder: $(date)" >> "${LOGFILE}"
        python3 "${PYFILE}" "${FEEDERSRV_URL}" 2>&1 | tee -a "${LOGFILE}" && rm -f running.lock &
    fi

    sleep 1800 # 30 minutes
done
