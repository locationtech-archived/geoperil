#!/bin/bash

output=${1}

plot_wave_height=${2}
plot_wave_time=${3}
world_pop=${4}
plot_cfz=${5}
plot_tfp=${6}
plot_cities=${7}

cfz_cpt=${8}
cfz_stroke=${9}
tfp_stroke=${10}
wave_height_cpt=${11}
world_pop_cpt=${12}
cities_fill=${13}
cities_stroke=${14}


wave_height_pslegend=${15}
wave_height_psscale=${16}

wave_time_pslegend=${17}

tfp_cfz_pslegend=${18}
tfp_cfz_psscale_1=${19}
tfp_cfz_psscale_2=${20}

world_pop_pslegend=${21}
world_pop_psscale_1=${22}
world_pop_psscale_2=${23}

city_pop_pslegend=${24}

created_y=${25}
map_width=${26}

date=${27}



#### wave height ####
if [ ${plot_wave_height} == Y ]
then
#-Dx1.6c/7.25c/2.8c/1c/BL
gmt pslegend ${wave_height_pslegend} -O -K -V <<EOF>> ${output}
H 10 Helvetica wave height
EOF
#-D3c/7.65c/6c/0.3ch
gmt psscale --MAP_ANNOT_OFFSET_PRIMARY=0.06c --MAP_FRAME_PEN=0.02c,black --FONT_ANNOT_PRIMARY=10p,Helvetica,black ${wave_height_psscale} -C${wave_height_cpt} -G0/1.5 -By+l[m] -Ef -Ba0.5f0.1 -O -K -V >> ${output}
fi

#### wave time ####
if [ ${plot_wave_time} == Y ]
then
#-Dx0c/3.5c/2.8c/1c/BL
gmt pslegend --FONT_ANNOT_PRIMARY=10p,Helvetica,black -R -J ${wave_time_pslegend} -O -V -K <<EOF>> ${output}
S 0c - 0.4c - 1p,red 0.5c Traveltime in 1 h
EOF
fi

#### TFP / CFZ ####
if [ ${plot_cfz} == Y ] || [ ${plot_tfp} == Y ]
then
#-Dx0.4c/5.6c/0c/1/BL
if [ ${plot_cfz} == Y ] && [ ${plot_tfp} == Y ]
then
gmt pslegend --FONT_ANNOT_PRIMARY=10p,Helvetica,black -P -R -J ${tfp_cfz_pslegend} -O -V -K <<EOF>> ${output}
N 2
#S 0c c 0.13c 255/255/255 0.01c,${tfp_stroke} 0.3c TFP
S 0c c 0.13c 255/255/255 0.01c,0/0/0 0.3c TFP
S 1.5c s 0.3c 255/255/255 0.01c,${cfz_stroke} 1.8c CFZ 
EOF
elif [ ${plot_cfz} == N ] && [ ${plot_tfp} == Y ]
then
gmt pslegend --FONT_ANNOT_PRIMARY=10p,Helvetica,black -P -R -J ${tfp_cfz_pslegend} -O -V -K <<EOF>> ${output}
S 0c c 0.13c 255/255/255 0.01c,0/0/0 0.3c TFP
EOF
elif [ ${plot_cfz} == Y ] && [ ${plot_tfp} == N ]
then
gmt pslegend --FONT_ANNOT_PRIMARY=10p,Helvetica,black -P -R -J ${tfp_cfz_pslegend} -O -V -K <<EOF>> ${output}
S 0c s 0.3c 255/255/255 0.01c,${cfz_stroke} 0.3c CFZ 
EOF
fi

#-D2c/6c/4c/0.3ch
#gmt psscale --MAP_ANNOT_OFFSET_PRIMARY=0.06c --MAP_FRAME_PEN=0.02c,black --FONT_ANNOT_PRIMARY=10p,Helvetica,black ${tfp_cfz_psscale} -C${cfz_cpt} -Ef -Ba1f0.2 -By+l[m] -G0/4 -O -K -V >> ${output}
gmt psscale --MAP_FRAME_PEN=0.02c,black --FONT_ANNOT_PRIMARY=10p,Helvetica,black ${tfp_cfz_psscale_1} -C${cfz_cpt} -Li -G0/0.5 -O -K -V >> ${output}
gmt psscale --MAP_FRAME_PEN=0.02c,black --FONT_ANNOT_PRIMARY=10p,Helvetica,black ${tfp_cfz_psscale_2} -C${cfz_cpt} -Li -G0.5/5 -O -K -V >> ${output}
fi


#### world pop ####
if [ ${world_pop} == Y ]
then
#-Dx8c/7.25c/4c/1c/BL
gmt pslegend ${world_pop_pslegend} -O -K <<EOF>> ${output}
L 10p Helvetica L Persons per km\262
EOF
#-D8c/7.05c/-1.2c/0.35c
gmt psscale --MAP_FRAME_PEN=0.02c,black --FONT_ANNOT_PRIMARY=10p,Helvetica,black ${world_pop_psscale_1} -C${world_pop_cpt} -Li -G0/25 -O -K -V >> ${output}
#-D9.8c/7.05c/-1.2c/0.35c
gmt psscale --MAP_FRAME_PEN=0.02c,black --FONT_ANNOT_PRIMARY=10p,Helvetica,black ${world_pop_psscale_2} -C${world_pop_cpt} -Li -G25/1100 -O -K -V >> ${output}
fi


#### cities ####
if [ ${plot_cities} == Y ]
then
#-Dx13c/6.31c/6c/BL
gmt pslegend --FONT_ANNOT_PRIMARY=10p,Helvetica,black ${city_pop_pslegend} -O -V -K <<EOF>> ${output}
L 10p Helvetica L Persons per city
G 0.05c
S 0c c 0.2c ${cities_fill} 0.01c,${cities_stroke} 0.3c < 1.5Mio
G 0.03c
S 0c c 0.25c ${cities_fill} 0.01c,${cities_stroke} 0.3c 1.5Mio - 3Mio
G 0.03c
S 0c c 0.3c ${cities_fill} 0.01c,${cities_stroke} 0.3c > 3Mio
EOF
fi

#### created on ####
gmt pslegend -Dx0c/${created_y}c/${map_width}c/BL -O -K <<EOF>> ${output}
L 6p Helvetica L Created on ${date} UTC, by TRIDEC Cloud 
EOF