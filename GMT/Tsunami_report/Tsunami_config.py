#!/usr/bin/env python3


###############
# Input-Daten #
###############

#Basemap Daten Directory
#basemap_data_dir = 'data/etopo/basemaps/'
basemap_data_dir = '/home/svenr/geohazardcloud/GMT/basemaps/'

#World-Population Datei
world_pop_data = 'data/world_pop2000_adj.nc'

#City-Population Datei
city_pop_data = 'data/cities.csv'


############################
######### Karte ############
############################

###############
### Basemap ###
###############
#Projection
#M = Mercator; J = Miller; Q = Cylindrical Equidistanz 
crs_system = 'M'

#Einheit fuer Printkarte: c = cm
unit = 'c'

#Breite der Karte in vorher eingegebener Eineit
map_width = '15.8'

#legt Aufloesung der Kuestenlinien fest;
#f=full, h=high, i=intermediate, l=low, c=crude
coast_res = 'i'

#Land-Aufloesung: Features kleiner als Eingabe werden nicht geplottet (in km²); z.B. Fluesse, Seen usw.
land_res = '1000'

#Traveltime-Data
#Abstaender der Isochronen in min
Isochrone_dist = '60'

