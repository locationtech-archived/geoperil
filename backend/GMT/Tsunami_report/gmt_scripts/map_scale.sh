#!/bin/bash

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

output=${1}


R=${2}
J=${3}

lon_mid=${4}
lat_mid=${5}

scalebar_length=${6}

y_map_dist=${7}

# plottet Maßstabsbalken in die untere linke Ecke der Karte
gmt psbasemap \
    --FONT_ANNOT_PRIMARY=8p,Helvetica,black \
    --MAP_SCALE_HEIGHT=3p ${R} ${J} \
    -P \
    -Lfx2.5c/0.6c/${lon_mid}/${lat_mid}/${scalebar_length}k+u \
    -Ya${y_map_dist} \
    -V -K -O \
    >> ${output}

# Maßstab
# gmt pslegend -R -J -Dx0c/0c/0c/BL -O -K -V <<EOF>> ${output}
# H 12 Helvetica map scale [km]
# M ${lon_mid} ${lat_mid}  2500+u f ${R} ${J}
# EOF
