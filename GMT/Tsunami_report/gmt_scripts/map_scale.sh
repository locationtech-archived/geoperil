#!/bin/bash

output=${1}


R=${2}
J=${3}

lon_mid=${4}
lat_mid=${5}

scalebar_length=${6}

y_map_dist=${7}

#plottet Massstabsbalken in die untere linke Ecke der Karte
gmt psbasemap --FONT_ANNOT_PRIMARY=8p,Helvetica,black --MAP_SCALE_HEIGHT=3p ${R} ${J} -P -Lfx2.5c/0.6c/${lon_mid}/${lat_mid}/${scalebar_length}k+u -Ya${y_map_dist} -V -K -O >> ${output}



	#Massstab
	#gmt pslegend -R -J -Dx0c/0c/0c/BL -O -K -V <<EOF>> ${output}
	#H 12 Helvetica map scale [km]
	#M ${lon_mid} ${lat_mid}  2500+u f ${R} ${J}
	#EOF