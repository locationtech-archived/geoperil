#!/bin/bash

output=${1}

tfp=${2}

tfp_0_03_fill=${3}
tfp_03_1_fill=${4}
tfp_1_3_fill=${5}
tfp_3_fill=${6}

tfp_cpt=${7}

tfp_stroke=${8}

y_map_distance=${9}


#plottet alle tfp in leicht durchsichtig, die nicht getroffen wurde
#awk "BEGIN {FS=\",\"}; \$4 < 0 {print \$1, \$2;}" ${tfp} | gmt psxy -R -J -P -W0.01c,white -i0,1 -Sc0.13c -G100/100/100 -t25 -Ya${y_map_distance} -O -V -K >> ${output}

#plottet alle tfps, die getroffen wurden
#awk "BEGIN {FS=\",\"}; \$3 >= 0 && \$3 < 0.3 && \$4 >= 0 {print \$1, \$2;}" ${tfp} | gmt psxy -R -J -P -W0.01c,${tfp_stroke} -i0,1 -Sc0.13c -G${tfp_0_03_fill} -Ya${y_map_distance} -O -V -K >> ${output}

#awk "BEGIN {FS=\",\"}; \$3 >= 0.3 && \$3 < 1 && \$4 >= 0 {print \$1, \$2;}" ${tfp} | gmt psxy -R -J -P -W0.01c,${tfp_stroke} -i0,1 -Sc0.13c -G${tfp_03_1_fill} -Ya${y_map_distance} -O -V -K >> ${output}

#awk "BEGIN {FS=\",\"}; \$3 >= 1 && \$3 < 3 && \$4 >= 0 {print \$1, \$2;}" ${tfp} | gmt psxy -R -J -P -W0.01c,${tfp_stroke} -i0,1 -Sc0.13c -G${tfp_1_3_fill} -Ya${y_map_distance} -O -V -K >> ${output}

#awk "BEGIN {FS=\",\"}; \$3 >= 3 && \$3 < 1000 && \$4 >= 0 {print \$1, \$2;}" ${tfp} | gmt psxy -R -J -P -W0.01c,${tfp_stroke} -i0,1 -Sc0.13c -G${tfp_3_fill} -Ya${y_map_distance} -O -V -K >> ${output}






awk "BEGIN {FS=\",\"}; \$4 < 0 {print \$1, \$2;}" ${tfp} | gmt psxy -R -J -P -W0.02c,${tfp_stroke} -i0,1 -Sc0.13c -G150/150/150 -t25 -Ya${y_map_distance} -O -V -K >> ${output}


awk "BEGIN {FS=\",\"}; \$4 >= 0 {print \$1, \$2, \$3;}" ${tfp} | gmt psxy -R -J -P -W0.02c,${tfp_stroke} -i0,1,2 -Sc0.13c -C${tfp_cpt} -t20 -Ya${y_map_distance} -O -V -K >> ${output}
