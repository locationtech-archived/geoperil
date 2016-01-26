#!/bin/bash

output=${1}

subtitle=${2}
subtitle_pos_y=${3}
map_width=${4}

#Unterueberschrift
gmt pslegend -Dx0c/${subtitle_pos_y}c/${map_width}c/BL -O -K <<EOF>> ${output}
L 12p Helvetica C ${subtitle}
EOF