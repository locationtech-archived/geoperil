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

# ./Tsunami_wave_traveltime.sh output y_map_dist wave_time Isochrone_dist
# Isochrone_color

output=${1}
wave_time_temp=${2}

y_map_dist=${3}

wave_time=${4}

Isochrone_dist=${5}
Isochrone_color=${6}

gmt grdclip ${wave_time} -G${wave_time_temp} -Sb0/NaN -V

# Erstellt Isolinien aus grd; -C=Intervall -A=Beschriftungsintervall
# gmt grdcontour ${wave_time} --FONT_ANNOT_PRIMARY=12p,Helvetica,red -R -J \
# -C${Isochrone_dist} -W${Isochrone_color} -A60+u' min' -L0/360 -P \
# -Ya${y_map_dist} -O -K -V >> ${output}

# gmt grdcontour ${wave_time_temp} \
# --FONT_ANNOT_PRIMARY=12p,Helvetica-Bold,red -R -J -C${Isochrone_dist} \
# -W${Isochrone_color} -A60+u' min' -P -Ya${y_map_dist} -O -K -V >> ${output}


# -A1+u' h'+apu+w250; apu=Beschriftung uphill; w250=Specifies how many (x,y)
# points will be used to estimate label angles
# gmt grdcontour ${wave_time_temp} -R -J -W0.007c,${Isochrone_color} \
# -Z0.01666666666666666666666666666667 \
# -A1+u' h'+apu+w250+f8p,Helvetica-Bold,red -P -Ya${y_map_dist} -O -K -V \
# >> ${output}

# gmt grdcontour ${wave_time_temp} -R -J -W0.007c,${Isochrone_color} \
# -Z0.01666666666666666666666666666667 -A1+u' hour'+f8p,Helvetica-Bold,red \
# -Gl10W/35N/80W/66N -P -Ya${y_map_dist} -O -K -V >> ${output}
gmt grdcontour ${wave_time_temp} -R -J -Wa0.03c,${Isochrone_color} -Wc0.03c,${Isochrone_color},- -Z0.01666666666666666666666666666667 -C0.5 -A1+u' hr'+f8p,Helvetica-Bold,${Isochrone_color} -P -Ya${y_map_dist} -O -K -V >> ${output}

rm ${wave_time_temp}

# gmt grdcontour ${wave_time} --FONT_ANNOT_PRIMARY=12p,Helvetica-Bold,red \
# -R -J -Z0.01666666666666666666666666666667 -W${Isochrone_color} \
# -A1+u' h'+apu+w250 -S200 -P -Ya${y_map_dist} -O -K -V >> ${output}
