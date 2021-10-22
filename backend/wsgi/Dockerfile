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

RUN DEBIAN_FRONTEND=noninteractive apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get upgrade -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y \
        python3-cffi \
        python3-brotli \
        libpango1.0-dev \
        apache2 \
        libapache2-mod-wsgi-py3 && \
    mkdir /geoperil && \
    chown www-data /geoperil

WORKDIR /srv/geoperil/wsgi

COPY requirements.txt .
RUN pip3 install -r requirements.txt

COPY entrypoint.sh .
COPY apache.conf /etc/apache2/conf-enabled/geoperil-wsgi.conf
COPY config.cfg .
COPY *.py /srv/geoperil/wsgi/

EXPOSE 80

VOLUME [ "/geoperil" ]

CMD [ "/srv/geoperil/wsgi/entrypoint.sh" ]
