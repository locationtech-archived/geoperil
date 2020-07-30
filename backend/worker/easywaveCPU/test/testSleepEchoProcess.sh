#!/bin/bash

WPS_URL="http://localhost:5000/wps"

curl -X POST \
  -H 'Content-Type: text/xml' \
  -d@sleepecho_post_content.xml \
  "${WPS_URL}"
