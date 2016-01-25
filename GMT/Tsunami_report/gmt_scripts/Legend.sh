#!/bin/bash

output=${1}

wave_height_cpt=${2}

plot_wave_height=${3}
plot_wave_time=${4}

wave_height_pslegend=${5}
wave_height_psscale=${6}
wave_time_pslegend=${7}

world_pop_cpt=${8}
world_pop_pslegend=${9}
world_pop_psscale_1=${10}
world_pop_psscale_2=${11}
city_pop_pslegend=${12}
plot_cities=${13}
world_pop=${14}

date=${15}
created_y=${16}
map_width=${17}

cities_fill=${18}
cities_stroke=${19}

#Unterüberschrift
#gmt pslegend -Dx0c/23.2c/15.8c/BL -O -K <<EOF>> ${output}
#L 12p Helvetica C Tsunami: 10.2.2015 10:22:01
#EOF

if [ ${plot_wave_height} == Y ]
then
gmt pslegend ${wave_height_pslegend} -O -K -V <<EOF>> ${output}
H 10 Helvetica wave height in meter
EOF

gmt psscale --FONT_ANNOT_PRIMARY=10p,Helvetica,black ${wave_height_psscale} -C${wave_height_cpt} -G0/1.5 -Bafg -O -K -V >> ${output}
fi

if [ ${plot_wave_time} == Y ]
then
#gmt pslegend -R -J -Dx10.8c/7.7c/4c/1/BL -O -K -V <<EOF>> ${output}
gmt pslegend -R -J ${wave_time_pslegend} -O -K -V <<EOF>> ${output}
S 0.15c - 0.5c - 1p,red 0.8c Traveltime in 1 h
EOF
fi


if [ ${world_pop} == Y ]
then
gmt pslegend ${world_pop_pslegend} -O -K <<EOF>> ${output}
L 10p Helvetica L Persons per km\262
EOF

gmt psscale --FONT_ANNOT_PRIMARY=10p,Helvetica,black ${world_pop_psscale_1} -C${world_pop_cpt} -L0.1c -G0/25 -O -K -V >> ${output}
gmt psscale --FONT_ANNOT_PRIMARY=10p,Helvetica,black ${world_pop_psscale_2} -C${world_pop_cpt} -L0.1c -G25/1100 -O -K -V >> ${output}
fi

if [ ${plot_cities} == Y ]
then
gmt pslegend --FONT_ANNOT_PRIMARY=10p,Helvetica,black ${city_pop_pslegend} -O -K -V <<EOF>> ${output}
L 10p Helvetica L Persons per city
G 0.2c
S 0c c 0.2c ${cities_fill} 0.01c,${cities_stroke} 0.4i < 1.5Mio
G 0.1c
S 0c c 0.25c ${cities_fill} 0.01c,${cities_stroke} 0.4i 1.5Mio - 3Mio
G 0.1c
S 0c c 0.3c ${cities_fill} 0.01c,${cities_stroke} 0.4i > 3Mio
EOF
fi

gmt pslegend -Dx0c/${created_y}c/${map_width}c/BL -O -K <<EOF>> ${output}
L 6p Helvetica L Created on ${date} UTC, by TRIDEC Cloud 
EOF
