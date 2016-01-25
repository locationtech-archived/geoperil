#!/bin/bash

output=${1}

tfp=${2}

tfp_0_03_fill=${3}
tfp_03_1_fill=${4}
tfp_1_3_fill=${5}
tfp_3_fill=${6}

tfp_stroke=${7}

y_map_distance=${8}

awk "BEGIN {FS=\",\"}; \$3 >= 0 && \$3 < 0.3 {print \$2, \$1;}" ${tfp} | gmt psxy -R -J -P -W0.01c,${tfp_stroke} -i0,1 -Sc0.13c -G${tfp_0_03_fill} -Ya${y_map_distance} -O -V -K >> ${output}

awk "BEGIN {FS=\",\"}; \$3 >= 0.3 && \$3 < 1 {print \$2, \$1;}" ${tfp} | gmt psxy -R -J -P -W0.01c,${tfp_stroke} -i0,1 -Sc0.13c -G${tfp_03_1_fill} -Ya${y_map_distance} -O -V -K >> ${output}

awk "BEGIN {FS=\",\"}; \$3 >= 1 && \$3 < 3 {print \$2, \$1;}" ${tfp} | gmt psxy -R -J -P -W0.01c,${tfp_stroke} -i0,1 -Sc0.13c -G${tfp_1_3_fill} -Ya${y_map_distance} -O -V -K >> ${output}

awk "BEGIN {FS=\",\"}; \$3 >= 3 && \$3 < 1000 {print \$2, \$1;}" ${tfp} | gmt psxy -R -J -P -W0.01c,${tfp_stroke} -i0,1 -Sc0.13c -G${tfp_3_fill} -Ya${y_map_distance} -O -V -K >> ${output}