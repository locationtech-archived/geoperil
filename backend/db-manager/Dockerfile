# GeoPeril - A platform for the computation and web-mapping of hazard specific
# geospatial data, as well as for serving functionality to handle, share, and
# communicate threat specific information in a collaborative environment.
#
# Copyright (C) 2021 GFZ German Research Centre for Geosciences
#
# SPDX-License-Identifier: Apache-2.0
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#   http://apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the Licence is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the Licence for the specific language governing permissions and
# limitations under the Licence.
#
# Contributors:
#   Johannes Spazier (GFZ)
#   Sven Reissland (GFZ)
#   Martin Hammitzsch (GFZ)
#   Matthias Rüster (GFZ)
#   Hannes Fuchs (GFZ)

FROM python:3.7-buster

ENV MONGO_CONNECTION mongodb://mongo
ENV DATA_INSERT_URL http://localhost/webguisrv/data_insert
ENV GEOFON_LIST_URL https://geofon.gfz-potsdam.de/eqinfo/list.php
ENV GEOFON_ALERTS_URL https://geofon.gfz-potsdam.de/data/alerts

WORKDIR /opt/db-manager

COPY requirements.txt .

RUN DEBIAN_FRONTEND=noninteractive apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get upgrade -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y \
        rsyslog \
        cron && \
    pip3 install -r requirements.txt

COPY World_water_body_limits_polygons.geojson.gz .
RUN gunzip World_water_body_limits_polygons.geojson.gz

COPY cleanup-crontab /etc/cron.d/geoperil-db-cleanup
COPY managerloop.sh .
COPY manager.py .
COPY cron-cleanup-db.sh .
COPY cleanup-db.py .

RUN chmod 0644 /etc/cron.d/geoperil-db-cleanup

CMD [ "/opt/db-manager/managerloop.sh" ]
