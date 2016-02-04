#!/bin/bash

output=${1}

tfp=${2}

tfp_cpt=${3}

tfp_stroke=${4}

y_map_distance=${5}


awk "BEGIN {FS=\",\"}; \$4 < 0 {print \$1, \$2;}" ${tfp} | gmt psxy -R -J -P -W0.02c,${tfp_stroke} -i0,1 -Sc0.13c -G150/150/150 -t25 -Ya${y_map_distance} -O -V -K >> ${output}


awk "BEGIN {FS=\",\"}; \$4 >= 0 {print \$1, \$2, \$3;}" ${tfp} | gmt psxy -R -J -P -W0.02c,${tfp_stroke} -i0,1,2 -Sc0.13c -C${tfp_cpt} -t20 -Ya${y_map_distance} -O -V -K >> ${output}
