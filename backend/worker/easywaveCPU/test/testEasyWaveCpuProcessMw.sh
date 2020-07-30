#!/bin/bash

WPS_URL="http://localhost:5000/wps"

curl -X POST \
  -H 'Content-Type: text/xml' \
  -d@easywavecpu_post_content_mw.xml \
  "${WPS_URL}"
