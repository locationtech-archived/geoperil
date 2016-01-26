#!/usr/bin/env python3


###############
# Input-Daten #
###############

#Basemap Daten Directory
basemap_data_dir = '/home/basti/Schreibtisch/sf_Lubuntu_shared/GMT/data/etopo/basemaps/'

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
#Einheit für Printkarte: c = cm
unit = 'c'
#Breite der Karte in vorher eingegebener Eineit
map_width = '15.8'
#Abstand der Karte vom unteren Blattrand in vorher eingegebener Eineit
#y_map_dist = '7'

#legt Auflösung der Küstenlinien fest;
#f=full, h=high, i=intermediate, l=low, c=crude
coast_res = 'i'
#R/G/B
coast_color = '60/60/60'

#Land-Auflösung: Features kleiner als Eingabe werden nicht geplottet (in km²); z.B. Flüsse, Seen usw.
land_res = '500'

#falls terrain=N --> Farben für Land und Wasser
#color_water = 'LightBlue'
color_water = '170/170/170'
#color_land = '226/226/214'
color_land = '80/80/80 -N1/0.01c,160/160/160 -N2/0.01c,90/90/90'


#Farben über Übersichtsglobus
color_globe_land = '173/209/166'
color_globe_water = 'LightBlue'

#CPT-Dateien:
#werden benötigt für Farbgebung von GRD-Dateien
etopo_water_cpt = 'cpt/blue.cpt'
etopo_land_cpt = 'cpt/brown.cpt'
#etopo_water_cpt = 'cpt/bathy_etopo.cpt'
#etopo_land_cpt = 'cpt/land_etopo.cpt'

#wave_height_cpt = 'cpt/waveheight_3.cpt'
wave_height_cpt = 'cpt/waveheight_1.cpt'

#world population GRID
world_pop_cpt = 'cpt/world_population/world_pop_label.cpt'

#cities
cities_fill = '230/26/26'
cities_stroke = '58/0/0'

#CFZ
cfz_cpt = 'cpt/CFZ/CFZ.cpt'
cfz_stroke = '35/35/35'

#TFP
tfp_0_03_fill = '75/203/0'
tfp_03_1_fill = '250/232/32'
tfp_1_3_fill = '242/158/23'
tfp_3_fill = '245/56/31'
tfp_stroke = '35/35/35'

#Quake
quake_fill = '252/255/0'

###############
### Tsunami ###
###############

#Traveltime-Data
#Abständer der Isochronen in min
Isochrone_dist = '60'
#Farbe der Isochronen
Isochrone_color = 'red'
