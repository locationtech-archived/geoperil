#!/bin/bash

KNOWN="/var/lib/tomcat8/.ssh/known_hosts"
IP=$(getent hosts worker | awk '{ print $1 }')

touch "${KNOWN}"
chown tomcat8:tomcat8 "${KNOWN}"
chmod 644 "${KNOWN}"
/usr/bin/ssh-keyscan worker > "${KNOWN}"
/usr/bin/ssh-keyscan "${IP}" >> "${KNOWN}"
