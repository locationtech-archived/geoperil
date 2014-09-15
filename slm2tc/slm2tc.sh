#!/bin/bash
cd `dirname $0`

if [ ! -e running.lock ] ; then
    touch running.lock
    ./slm2tc.py $* >> slm2tc.log 2>&1
    rm -f running.lock
    fi
