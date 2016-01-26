#!/bin/bash

output=${1}

coast_res=${2}

R=${3}
J=${4}

coast_res=${2}

#Anfang clip Land "-Gc"; "-D" fuer Aufloesung der Kuestenlinien
gmt pscoast -J -R -P -V -K -O -D${coast_res} -Gc -Y >> ${output} 
	
#erstellt land mit hillshade
gmt grdimage -J -R -P -V -K -O -C/home/basti/Schreibtisch/Tsunami_report/cpt/world_population/world_pop3.cpt /home/basti/Schreibtisch/sf_Lubuntu_shared/GMT/data/world_pop/world_pop2000_adj.nc -Y >> ${output}
	
#Ende Clip Land "-Q"
gmt pscoast -J -R -P -V -K -O -Q -Y >> ${output}