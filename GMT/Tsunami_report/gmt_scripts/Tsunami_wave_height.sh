#!/bin/bash

#./Tsunami_wave_height.sh output wave_height_data wave_height_temp expression wave_height_cpt y_map_dist


#output=PS_files/test.ps
#wave_height_data=/home/basti/Schreibtisch/sf_Lubuntu_shared/GMT/data/tsunami/HDF600/eWave.2D.sshmax
#wave_height_temp=/home/basti/Schreibtisch/sf_Lubuntu_shared/GMT/data/tsunami/HDF600/eWave_height_temp.nc
#expression=0.05
#wave_height_cpt=cpt/waveheight_3.cpt

output=${1}
wave_height_data=${2}
wave_height_temp=${3}
expression=${4}
wave_height_cpt=${5}
y_map_dist=${6}

#Clipt grd nach Kriterien; -Sb alle Werte unter expression werden zu NaN
gmt grdclip ${wave_height_data} -G${wave_height_temp} -Sb${expression}/NaN -V

#runtime plot aus grd-datei "-nn+t0" wichtig fuer interpolation; "Q" fuer transparenz von nodata
gmt grdimage ${wave_height_temp} -J -R -P -C${wave_height_cpt} -t20 -V -Q -nn -Ya${y_map_dist} -K -O >> ${output}
#gmt grdimage ${wave_height_temp} -J -R -P -B -C${wave_height_cpt} -V -Q -nn -Ya${y_map_dist} -K -O >> ${output}


rm ${wave_height_temp}