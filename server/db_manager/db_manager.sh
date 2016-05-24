#!/bin/bash
cd `dirname $0`

if [ ! -e running.lock ] ; then
    touch running.lock
    ./manager.py >> log 2>&1
    rm -f running.lock
fi
