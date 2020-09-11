#!/bin/bash

cd `dirname $0`
touch "slm.log"

trap "rm -f running.lock" EXIT

while true; do
    if [ ! -e running.lock ]; then
        echo $$ > running.lock
        if [ "$(du -s slm.log | cut -f1)" -gt 100000 ] ; then
            mv "slm.log" "slm.log.old"
            touch "slm.log"
        fi
        python3 slm.py 2>&1 | tee -a "slm.log" && rm -f running.lock &
    fi

    sleep 60
done
