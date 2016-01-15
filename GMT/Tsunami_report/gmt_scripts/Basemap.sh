#!/bin/bash

#########################
#passed arguments

#./Basemap.sh title output extent projection y_map_dist basemap basemap_hillshade 
#	outline coast_res coast_color dem(terrain) color_water color_land color_globe_land color_globe_water land_res etopo_water_cpt etopo_land_cpt

title=${1}
output=${2}

extent=${3}

projection=${4}

y_map_dist=${5}

basemap=${6}
basemap_hillshade=${7}

outline=${8}
coast_res=${9}
coast_color=${10}
#dem = digital elevation modell
dem=${11}

color_water=${12}
color_land=${13}

color_globe_land=${14}
color_globe_water=${15}

land_res=${16}

etopo_water_cpt=${17}
etopo_land_cpt=${18}

world_pop_data=${19}
world_pop_cpt=${20}
world_pop=${21}

subtitle=${22}
paper_height=${23}
#########################


#######################################
############ Basemap ##################
#######################################

gmtset MAP_FRAME_TYPE plain
gmtset PS_MEDIA 21.0cx${paper_height}c

if [ "${title}" == -None- ]
#Erstellt leeren Kartenrahmen; -BWSen (Süd und West-Achse werden beschriften, Nord und Ost nur geplottet);fügt Titel an Karte falls eingestellt
then
	gmt psbasemap --FONT_ANNOT_PRIMARY=8p,Helvetica,black ${projection} ${extent} -P -Ba -BNWes -Ya${y_map_dist} -V -K > ${output}
else
	if [ "${subtitle}" == -None- ]
	then
		gmt psbasemap --FONT_ANNOT_PRIMARY=8p,Helvetica,black --FONT_TITLE=22p,Helvetica-Bold,black --MAP_TITLE_OFFSET=14p ${projection} ${extent} -P -Ba -BNWes+t"${title}" -Ya${y_map_dist} -V -K > ${output}
	else
		gmt psbasemap --FONT_ANNOT_PRIMARY=8p,Helvetica,black --FONT_TITLE=22p,Helvetica-Bold,black --MAP_TITLE_OFFSET=25p ${projection} ${extent} -P -Ba -BNWes+t"${title}" -Ya${y_map_dist} -V -K > ${output}	
	fi
fi

if [ ${dem} == Y ]
then 
	#erstellt eine Basemap auf Grundlage von ETOPO-Daten
	#erstellt meer mit hillshade;
	gmt grdimage -J -R -P -V -K -O ${basemap} -I${basemap_hillshade} -C${etopo_water_cpt} -Y >> ${output}
	
	#Anfang clip Land "-Gc"; "-D" für Auflösung der Küstenlinien
	gmt pscoast -J -R -P -V -K -O -D${coast_res} -Gc -Y >> ${output} 
	
	if [ ${world_pop} == Y ]
	then
		gmt grdimage -J -R -P -V -K -O -C${world_pop_cpt} ${world_pop_data} -Y >> ${output}
	else
		#erstellt land mit hillshade
		gmt grdimage -J -R -P -V -K -O -C${etopo_land_cpt} ${basemap} -I${basemap_hillshade} -Y >> ${output}
	fi
	
	#Ende Clip Land "-Q"
	gmt pscoast -J -R -P -V -K -O -Q -Y >> ${output}
	
	if [ ${outline} == Y ]
	then
	#erstellt Karte mit outline
		#für Kontur "-W"
		gmt pscoast -J -R -P -V -O -K -D${coast_res} -A${land_res} -W0.002c,${coast_color} -Y >> ${output}	
	fi
	
elif [ ${dem} == N ]
then
#Erstellt einfache zweifarbe Basemap
	if [ ${outline} == Y ]
	then
	#erstellt Karte mit outline
		if [ ${world_pop} == Y ]
		then
			gmt grdimage -J -R -P -V -K -O -C${world_pop_cpt} ${world_pop_data} -Y >> ${output}
			gmt pscoast -J -R -P -V -O -K -D${coast_res} -A${land_res} -W0.002c,${coast_color} -S${color_water} -Y >> ${output}
		else
			gmt pscoast -J -R -P -D${coast_res} -A${land_res} -S${color_water} -G${color_land} -W0.002c,${coast_color} -Ya${y_map_dist} -V -K -O >> ${output}
		fi
	else
	#erstellt Karte ohne outline
		if [ ${world_pop} == Y ]
		then
			gmt grdimage -J -R -P -V -K -O -C${world_pop_cpt} ${world_pop_data} -Y >> ${output}
			gmt pscoast -J -R -P -V -O -K -D${coast_res} -A${land_res} -S${color_water} -Y >> ${output}
		else
			gmt pscoast -J -R -P -D${coast_res} -A${land_res} -S${color_water} -G${color_land} -Ya${y_map_dist} -V -K -O >> ${output}
		fi
	fi
fi

#PseudoCommand; beendet das Overlay; Plottet unsichtbare Flüsse/Seen
#gmt pscoast -J -R -P -B -O -C-t100 -Y >> ${output}