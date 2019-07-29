#!/bin/bash

# GeoPeril - A platform for the computation and web-mapping of hazard specific
# geospatial data, as well as for serving functionality to handle, share, and
# communicate threat specific information in a collaborative environment.
#
# Copyright (C) 2013 GFZ German Research Centre for Geosciences
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
# Sebastian Juengling (GFZ) - initial implementation
# Johannes Spazier (GFZ) - initial implementation
# Sven Reissland (GFZ) - initial implementation
# Martin Hammitzsch (GFZ) - initial implementation

#./Globus.sh output west east south north lon_mid lat_mid y_globe x_globe color_globe_land color_globe_water

output=${1}

west=${2}
east=${3}
south=${4}
north=${5}

lon_mid=${6}
lat_mid=${7}

y_globe=${8}
x_globe=${9}

color_globe_land=${10}
color_globe_water=${11}
color_globe_stroke=${12}



###############################
##### Uebersichts-Globus ######
###############################

gmt pscoast --MAP_FRAME_PEN=0.5p --MAP_GRID_PEN_PRIMARY=0.0001p,${color_globe_stroke} -Rg -JG${lon_mid}/${lat_mid}/1.2i -Bg -Dc -A7000 -G${color_globe_land} -S${color_globe_water} -W0.01p -P -Ya${y_globe} -Xa${x_globe} -V -O -K>> ${output}

#Zeigt rote bounding box auf Globus an
gmt psxy -J -R -W1p,red -Ya${y_globe} -Xa${x_globe} -O -K -V <<EOF>> ${output}
${west}	${north}
${east}	${north}
${east}	${south}
${west}	${south}
${west}	${north}
EOF

#PseudoCommand; beendet das Overlay; Plottet unsichtbare Flüsse/Seen
#gmt pscoast -J -R -P -B -O -C-t100 -Y >> ${output}
