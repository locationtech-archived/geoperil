#!/bin/bash
cd `dirname $0`

if [ ! -e running.lock ] ; then
    touch running.lock
    if [ `du -s slm2tc.log | cut -f1` -gt 100000 ] ; then
        mv slm2tc.log slm2tc.log.old
        fi
    ./slm2tc.py $* >> slm2tc.log 2>&1
    rm -f running.lock
    fi
