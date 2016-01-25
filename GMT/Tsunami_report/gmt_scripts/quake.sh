#!/bin/bash

output=${1}

quake=${2}

quake_fill=${3}

y_map_distance=${4}


#Pop = 0 bis 1.500.000
awk "BEGIN {FS=\",\"}; \$3 < 5 {print \$1, \$2;}" ${quake} | gmt psxy -R -J -P -W0.01c,35/35/35 -i0,1 -Sa0.35c -G${quake_fill} -Ya${y_map_distance} -O -K >> ${output}
#Pop = 1.500.000 bis 3.000.000
awk "BEGIN {FS=\",\"}; \$3 >= 5 && \$3 < 7 {print \$1, \$2;}" ${quake} | gmt psxy -R -J -P -W0.01c,35/35/35  -i0,1 -Sa0.45c -G${quake_fill} -Ya${y_map_distance} -O -K >> ${output}
#Pop > 3.000.000
awk "BEGIN {FS=\",\"}; \$3 >= 7 {print \$1, \$2;}" ${quake} | gmt psxy -R -J -P -W0.01c,35/35/35  -i0,1 -Sa0.55c -G${quake_fill} -Ya${y_map_distance} -O -K >> ${output}