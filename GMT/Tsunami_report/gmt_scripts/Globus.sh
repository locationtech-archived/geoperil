#!/bin/bash

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