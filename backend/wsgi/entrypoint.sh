#!/bin/bash

/usr/sbin/apache2ctl start
tail -f /var/log/apache2/error_geoperil.log
