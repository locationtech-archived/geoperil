#!/bin/bash

output=${1}

cfz=${2}

cfz_cpt=${3}
cfz_stroke=${4}

y_map_distance=${5}


gmt psxy -R -J -P -W0.01c,${cfz_stroke} -L ${cfz} -C${cfz_cpt} -Ya${y_map_distance} -t40 -V -O -K >> ${output}