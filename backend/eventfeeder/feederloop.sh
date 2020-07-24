#!/bin/bash

PYFILE="eventfeeder.py"
LOGFILE="eventfeeder.log"

while true; do
    echo "Started feeder: $(date)" >> "${LOGFILE}"
    python3 "${PYFILE}" "${FEEDERSRV_URL}" 2>&1 | tee -a "${LOGFILE}"
    sleep 1800 # 30 minutes
done
