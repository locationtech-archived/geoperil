#!/usr/bin/env python3

import subprocess
import argparse
import math
import datetime
import re

#config-file
from Tsunami_config import *

#Python-Script fuer Berechnung des Kartenrahmens
from auto_extent import *

#Python-Script fuer Berechnugn der Position der Legendenbestandteile
from build_legend import *

###########################################
####### passed argmunents with flags ######
###########################################
parser = argparse.ArgumentParser(formatter_class=argparse.RawTextHelpFormatter)

parser.add_argument("-t", "--title", dest = "title", default = "-None-", help="Titel fuer Karte")
parser.add_argument("-st", "--subtitle", dest = "subtitle", default = "-None-", help="Unterueberschrift fuer Karte")
parser.add_argument("-o", "--output", dest = "output", default = "/home/basti/GMT/Tsunami_report/PS_files/default_output.ps", help="Pfad der Output-Datei")
parser.add_argument("-e_w", "--extent_west", dest = "extent_west", help="Karteninhalt: West")
parser.add_argument("-e_e", "--extent_east", dest = "extent_east", help="Karteninhalt: Ost")
parser.add_argument("-e_s", "--extent_south", dest = "extent_south", help="Karteninhalt: Sued")
parser.add_argument("-e_n", "--extent_north", dest = "extent_north", help="Karteninhalt: Nord")

#parser.add_argument("-crs_sys", "--crs_system", dest = "crs_system", default = "M", help="Koordinatensystem der Karte \n(default=Q)")
#parser.add_argument("-m_width", "--map_width", dest = "map_width", default = "15.8", help="Breite der der Karte in cm \n(default = 15.8)")

#Seitenverhaeltnis Kartenrahmen	
parser.add_argument("-y_r", "--y_ratio", dest = "y_ratio", default = "4", help="Kartenrahmenverhaeltnis: Y-Achse \n(default = 4)")
parser.add_argument("-x_r", "--x_ratio", dest = "x_ratio", default = "5", help="Kartenrahmenverhaeltnis: X-Achse \n(default = 5)")

###Tsunami-Daten###
#Wave-Height
parser.add_argument("-w_height", "--wave_height", dest = "wave_height", default = "/home/basti/Schreibtisch/sf_Lubuntu_shared/GMT/data/tsunami/HDF600/eWave.2D.sshmax", help="Pfad fuer GRD-Datei fuer Wellenhoehe\nz.B.: .../eWave.2D.sshmax")
parser.add_argument("-w_exp", "--wave_height_expression", dest = "wave_height_expression", default = "0.05", help="Alle Wellenhoehenwerte unter diesem Wert werden nicht angezeigt")
#Wave-Time
parser.add_argument("-w_time", "--wave_time", dest = "wave_time", default = "/home/basti/Schreibtisch/sf_Lubuntu_shared/GMT/data/tsunami/HDF600/eWave.2D.time", help="Pfad fuer GRD-Datei fuer Traveltime\nz.B.: eWave.2D.time")

#CFZs
parser.add_argument("-cfz", "--cfz", dest = "cfz", default = "/home/basti/Schreibtisch/sf_Lubuntu_shared/GMT/data/CFZ/CFZ_test/cfz2.gmt", help="Pfad fuer GMT-Datei fuer Coastal-Forecast-Zones")

#TFPs
parser.add_argument("-tfp", "--tfp", dest = "tfp", default = "/home/basti/Schreibtisch/sf_Lubuntu_shared/GMT/data/TFPs/tfp.csv", help="Pfad fuer CSV-Datei fuer Tsunami-Forecast-Points")

#Quake
parser.add_argument("-q", "--quake", dest = "quake", default = "/home/basti/Schreibtisch/sf_Lubuntu_shared/GMT/data/quake/quake.csv", help="Pfad fuer CSV-Datei fuer Erdbeben")


#Einstell/Plot-Moeglichkeiten
parser.add_argument("-p_dem", "--plot_dem", dest = "dem", default = "N", help="DEM als Basemap?\nJa = Y\nNein = N")
parser.add_argument("-p_w_height", "--plot_wave_height", dest = "plot_wave_height", default = "N", help="Plott GRD-Datei fuer Wellenhoehe?\nJa = Y\nNein = N")
parser.add_argument("-p_w_time", "--plot_wave_time", dest = "plot_wave_time", default = "N", help="Plot GRD-Datei fuer Traveltime?\nJa = Y\nNein = N")

parser.add_argument("-p_w_pop", "--plot_world_pop", dest = "world_pop", default = "N", help="Population-GRID Plotten?\nJa = Y\nNein = N")

parser.add_argument("-p_cfz", "--plot_cfz", dest = "plot_cfz", default = "N", help="Coastal-Forecast-Zones Plotten?\nJa = Y\nNein = N")
parser.add_argument("-p_tfp", "--plot_tfp", dest = "plot_tfp", default = "N", help="Tsunami-Forecast-Points Plotten?\nJa = Y\nNein = N")
parser.add_argument("-p_q", "--plot_quake", dest = "plot_quake", default = "N", help="Erdbeben Plotten?\nJa = Y\nNein = N")


parser.add_argument("-p_c", "--plot_cities", dest = "plot_cities", default = "N", help="Cities Plotten?\nJa = Y\nNein = N")
parser.add_argument("-c_pop", "--cities_pop", dest = "cities_pop", default = "0", help="Cities above will be plotted [in Mio]")
parser.add_argument("-c_c", "--cities_capital", dest = "cities_capital", default = "N", help="Plot only capitals?\nJa = Y\nNein = N")
parser.add_argument("-c_l", "--cities_label", dest = "cities_label", default = "N", help="Plot city labels?\nJa = Y\nNein = N")
parser.add_argument("-c_l_p", "--cities_label_pop", dest = "cities_label_pop", default = "N", help="cities above will be labelled")

parser.add_argument("-p_o", "--plot_outline", dest = "plot_outline", default = "N", help="Plot Outline fuer Landmassen?\nJa = Y\nNein = N")

parser.add_argument("-p_g", "--plot_globe", dest = "plot_globe", default = "Y", help="uebersichtsglobus Plotten?\nJa = Y\nNein = N")
parser.add_argument("-p_ms", "--plot_map_scale", dest = "plot_map_scale", default = "Y", help="Massstabsbalken Plotten?\nJa = Y\nNein = N")


args = parser.parse_args()

#############################################
######## passing argument in variables ######
#############################################
title = args.title
subtitle = args.subtitle

#output_data_dir = args.output_data_dir
#output = args.output
#output = '%s%s' % (output_data_dir, output)
output = args.output
#Ausdehnung Karteninhalt
west, east, south, north = None, None, None, None
west = args.extent_west
east = args.extent_east
south = args.extent_south
north = args.extent_north
#Koordinatensystem
#crs_system = args.crs_system

#Breite der Karte in cm
map_width = float(map_width)
#Seitenverhaeltnis des Kartenrahmens z.B. 4/5
#		 _________	
#		|	  |
#       y_ratio	|         |
#		|	  |
#		|_________|
#		  x_ratio 
#
#y_ratio muss kleiner sein als x_ratio
y_ratio = float(args.y_ratio)
x_ratio = float(args.x_ratio)

wave_height = args.wave_height
wave_height_temp = 'data/temp/eWave_height_temp.nc'
wave_height_expression = float(args.wave_height_expression)
if wave_height_expression <= 0:
        wave_height_expression = 0.00000000000000001


wave_time = args.wave_time
wave_time_temp = 'data/temp/eWave_time_temp.nc'

#CFZs
cfz =  args.cfz
plot_cfz = args.plot_cfz
#TFPs
tfp = args.tfp
plot_tfp = args.plot_tfp
#Quake
quake = args.quake
plot_quake = args.plot_quake

#Plot? Y/N
dem = args.dem
plot_wave_height = args.plot_wave_height
plot_wave_time = args.plot_wave_time
world_pop = args.world_pop
plot_cities = args.plot_cities
cities_pop = args.cities_pop
cities_capital =args.cities_capital
cities_label =  args.cities_label
cities_label_pop = args.cities_label_pop

plot_globe = args.plot_globe
plot_map_scale = args.plot_map_scale

outline = args.plot_outline

date = datetime.datetime.utcnow().strftime("%Y, %B %d, %H:%M")

#gibt Eingabewerte zur uebersicht aus
print ('Titel:               ', title)
print ('Output-Datei:        ', output)

print ('Ausdehnung')
print ('    west:            ', west)
print ('    ost:             ', east)
print ('    sued:             ', south)
print ('    nord:            ', north)

print ('Koordinatensystem:   ', crs_system)
print ('Kartenbreite:        ', map_width, 'cm') 
print ('Seitenverhaeltnis:     %s/%s' % (y_ratio, x_ratio))

print ('Input-Dateien')
print ('    Basemap-DataDir: ', basemap_data_dir)
#print ('    Tsunami-DataDir: ', wave_data_dir)
print ('    Wellenhoehe:      ', wave_height)
print ('    Traveltime:      ', wave_time)


##############################################
################# Berechnungen ###############
##############################################

############################
## Kartenabstand (unten) ###
############################
y_map_dist = 2

layer_list_count = [plot_wave_time, world_pop, plot_cities].count("Y")

if (plot_wave_height=="Y" and layer_list_count <=1) or (plot_wave_height=="N" and layer_list_count >=1):
    y_map_dist += 2
elif plot_wave_height=="Y" and layer_list_count >1:
    y_map_dist += 4 
    
map_height = (map_width * y_ratio) / x_ratio  

subtitle_pos_y = y_map_dist + map_height + 0.7  

#berechnet blatthoehe
if not title=="-None-" and subtitle=="-None-":
    paper_height = y_map_dist + map_height + 2.5
elif not title=="-None-" and not subtitle=="-None-":
    paper_height = y_map_dist + map_height + 2.8
else:
    paper_height = y_map_dist + map_height + 1.3


############################
######### Extent ###########
############################
#gibt den max z-Wert des Wellenhoehen-GRIDs aus
wave_height_max = get_maxmin_wave_height(wave_height)
#Falls keine/oder nicht vollstaendige Ausdehnung eingegeben wird, wird die Ausdehnung automatisch anhand des Tsunami-GRIDs und w_exp berechnet

if (west is None) or (east is None) or (north is None) or (south is None):
    if wave_height_expression < wave_height_max:
        west, east, south, north = calc_extent_for_w_height(wave_height, west, east, south, north, wave_height_expression)
    else:
        west, east, south, north = calc_extent_for_w_time(wave_time, west, east, south, north)	

#Falls keine/oder nicht vollstaendige Ausdehnung eingegeben wird, wird die Ausdehnung automatisch anhand des Tsunami-Traveltime-GRIDs berechnet
#west, east, south, north = calc_extent_for_w_time(wave_time, west, east, south, north)	


west = float(west)
east = float(east)
south = float(south)
north = float(north)



print ('Extent before calculation:')
print (    'west:  ', west)
print (    'east:  ', east)
print (    'south: ', south)
print (    'north: ', north)

############################
####### Kartenrahmen #######
############################


#Berechnet automatisch die Groesse des Kartenrahmen
#Funktion eingeladen aus auto_extent.py
west, east, south, north, width, height, lon_diff, lat_diff = calc_coords(west, east, south, north, crs_system, map_width, unit, y_ratio, x_ratio)


#Berechnet Kartenmittelpunkt
lon_mid = west + (lon_diff / 2)
lat_mid = south + (lat_diff /2)

#Berechnet Laenge der lon-Distanz im Kartenmittelpunkt in km
lon_dist = (math.pi / 180) * 6370 * lon_diff * math.cos(math.radians(lat_mid))
#1/6 von lon_dist gerundet auf naechste Hundert fuer scalebar
scalebar_length = round((lon_dist/4) / 100) * 100


###############################
# Basemap optimale Pixelgroesse #
###############################
#Berechnet ungefaehre Pixelgroesse der Etopo-Basemap in km
ppi = 600

#berechnet optimale Pixelgroesse in arc-minute
one_inch_in_degree = lon_diff / (map_width / 2.54)
perfect_pixel_size = (one_inch_in_degree / ppi) * 60
#Pixelgroesse in Kilometer
pixel_km = perfect_pixel_size * ((math.pi / 180) * 6370 / 60)

"""
def choose_best_basemap (psize):
    if psize <= 1.0:
        return '1'
    elif psize <= 1.5:
        return '1.5'
    elif psize <= 2.0:
        return '2'
    elif psize <= 3.0:
        return '3'	
    elif psize <= 4.0:
        return '4'
    elif psize <= 6.0:
        return '6'
    elif psize <= 8.0:
        return '8'
    else:
        return '12'
"""

def choose_best_basemap (psize):
    #if psize <= 1.0:
    #    return '0.5'
    #elif psize <= 1.5:
    if psize <= 1.5:
        return '1'
    elif psize <= 2.0:
        return '1.5'
    elif psize <= 3.0:
        return '2'
    elif psize <= 4.0:
        return '3'	
    elif psize <= 6.0:
        return '4'
    elif psize <= 8.0:
        return '6'
    elif psize <= 12.0:
        return '8'
    else:
        return '12'
	
basemap_size = choose_best_basemap(perfect_pixel_size)

#legt Speicherort der Basemap fest
basemap='%s%s/basemap_%s.nc' %(basemap_data_dir, basemap_size, basemap_size)
basemap_hillshade='%s%s/basemap_%s_shade.nc' %(basemap_data_dir, basemap_size, basemap_size)

##################################################
###############   GMT   ##########################
##################################################

#############################
######### Basemap ###########
#############################
R = '-R%s/%s/%s/%s' % (west, east, south, north)
J = '-J%s%s%s' % (crs_system, map_width, unit)
y_map_distance = '%s%s' % (y_map_dist, unit)
#map_height = (map_width * y_ratio) / x_ratio

#./Basemap.sh title output extent projection y_map_dist basemap basemap_hillshade 
#	outline coast_res coast_color terrain color_water color_land color_globe_land color_globe_water land_res etopo_water_cpt etopo_land_cpt
subprocess.call(['./gmt_scripts/Basemap.sh', title,output , R, J, y_map_distance, basemap, basemap_hillshade, \
    outline, coast_res, coast_color, dem, color_water, color_land, color_globe_land, color_globe_water, land_res, etopo_water_cpt, etopo_land_cpt, \
    world_pop_data, world_pop_cpt, world_pop, subtitle, str(paper_height)])

if not subtitle=="-None-":
    subprocess.call(['./gmt_scripts/subtitle.sh',output , str(subtitle), str(subtitle_pos_y), str(map_width)])

###################################
############# Karte ###############
###################################

####### Wellenhoehen #########
#plottet die Wellenhoehen
if plot_wave_height=="Y":
    #./Tsunami_wave_height.sh output wave_height_data wave_height_temp expression wave_height_cpt
    subprocess.call(['./gmt_scripts/Tsunami_wave_height.sh', output, wave_height, wave_height_temp, str(wave_height_expression), wave_height_cpt, y_map_distance])

######## Traveltime #########
#Plottet die Traveltime als Isochrone
if plot_wave_time=="Y":
    #./Tsunami_wave_traveltime.sh output y_map_dist wave_time Isochrone_dist Isochrone_color
    subprocess.call(['./gmt_scripts/Tsunami_wave_traveltime.sh',output ,wave_time_temp ,y_map_distance, wave_time, Isochrone_dist, Isochrone_color])

########### CFZ #############
if plot_cfz=="Y":
    subprocess.call(['./gmt_scripts/CFZ.sh',output ,cfz, cfz_cpt, cfz_stroke, y_map_distance])
    
########### TFP #############
if plot_tfp=="Y":
    subprocess.call(['./gmt_scripts/TFP.sh',output ,tfp, tfp_0_03_fill, tfp_03_1_fill, tfp_1_3_fill, tfp_3_fill, tfp_stroke, y_map_distance])

########## Quakes ###########
if plot_quake=="Y":
    subprocess.call(['./gmt_scripts/quake.sh',output ,quake, quake_fill, y_map_distance])    

######## city pop ###########
if cities_capital=="Y":
    cities_capital = '&& $6 == "Admin-0 capital"'
else:
    cities_capital = ''    

#wenn keine Mindest-Populationsanzahl fuer die Labels angegeben wird, dann wird die Mindestanzahl der Staedte uebernommen
if cities_label_pop=="N":
    cities_label_pop = cities_pop

if plot_cities=="Y":
    subprocess.call(['./gmt_scripts/city_population.sh', output, R, J, y_map_distance, city_pop_data, cities_pop, cities_capital, cities_label, cities_label_pop, cities_fill, cities_stroke])


#############################
##### uebersichts-Globus #####
#############################
#Printet einen uebersichtsglobus
if plot_globe=="Y":
    y_globe_dist = float(y_map_dist) - 0.7
    x_globe_dist = float(width) - 2.2

    #./Globus.sh output west east south north lon_mid lat_mid y_globe x_globe color_globe_land color_globe_water
    subprocess.call(['./gmt_scripts/Globus.sh', output, str(west), str(east), str(south), str(north), str(lon_mid), str(lat_mid), str(y_globe_dist), str(x_globe_dist), color_globe_land, color_globe_water])


######################################
############## Legende ###############
######################################

######## map scale ##########
if plot_map_scale=="Y":
    subprocess.call(['./gmt_scripts/map_scale.sh', output, R, J, str(lon_mid), str(lat_mid), str(scalebar_length), y_map_distance])

########## Legende ##########

#Berechnet die Positionen der Legendenbestandteile
legend_positions = calc_legend_positions(world_pop, plot_cities, plot_wave_time, plot_wave_height, y_map_dist)
#    Aufbau von legend_positions:
#wave_height_legend = [wave_height_pslegend_x, wave_height_pslegend_y, wave_height_psscale_x, wave_height_psscale_y, wave_height_psscale_length]
#wave_time_legend = [wave_time_x, wave_time_y] 
#world_pop_legend = [world_pop_pslegend_x, world_pop_pslegend_y, world_pop_psscale_x_1, world_pop_psscale_x_2, world_pop_psscale_y]
#city_pop_legend = [city_pop_pslegend_x, city_pop_pslegend_y]
#legend_positions = [wave_height_legend, wave_time_legend, world_pop_legend, city_pop_legend]

wave_height_pslegend = '-Dx%sc/%sc/2.8c/1c/BL' % (legend_positions[0][0], legend_positions[0][1])
wave_height_psscale = '-D%sc/%sc/%sc/0.5ch' % (legend_positions[0][2], legend_positions[0][3], legend_positions[0][4])
wave_time_pslegend = '-Dx%sc/%sc/4c/1c/BL' % (legend_positions[1][0], legend_positions[1][1])

world_pop_pslegend = '-Dx%sc/%sc/4c/1c/BL' % (legend_positions[2][0], legend_positions[2][1])
world_pop_psscale_1 = '-D%sc/%sc/-1.5c/0.4c' % (legend_positions[2][2], legend_positions[2][4])
world_pop_psscale_2 = '-D%sc/%sc/-1.5c/0.4c' % (legend_positions[2][3], legend_positions[2][4])
city_pop_pslegend = '-Dx%sc/%sc/6c/BL' % (legend_positions[3][0], legend_positions[3][1])

created_y = y_map_dist - 0.6

#erstellt Legende
subprocess.call(['./gmt_scripts/Legend.sh', output, wave_height_cpt, plot_wave_height, plot_wave_time, \
    wave_height_pslegend, wave_height_psscale, wave_time_pslegend, \
    world_pop_cpt, world_pop_pslegend, world_pop_psscale_1, world_pop_psscale_2, city_pop_pslegend, plot_cities, world_pop, \
    date, str(created_y), str(map_width), cities_fill, cities_stroke])

######################################
###### Umwandlung in PNG/PDF #########
######################################

#PseudoCommand; beendet das Overlay; Plottet unsichtbare Fluesse/Seen
#gmt pscoast -J -R -P -O -C-t100 -Y >> ${output}
subprocess.call(['./gmt_scripts/pseudo_end.sh', output, R, J])

#erstellt png-Datei
#gmt ps2raster default_output.ps -A -Tg -V
#-A plottet nur Karteninhalt
subprocess.call(['gmt', 'ps2raster', output, '-Tg', '-A', '-V', '-E720'])
#PDF
#subprocess.call(['gmt', 'ps2raster', output, '-Tf', '-V'])


##################################################
################# INFO - Output ##################
##################################################

print ('\n\nBerechnungen:')
print ('    Ausdehnung / Kartenrahmen:')
print ('        Breite (cm): ', width)
print ('        Hoehe (cm):   ', height)
print ('\n        west: ', west)
print ('        ost:  ', east)
print ('        nord: ', north)
print ('        sued:  ', south)

print ('    lon/lat - Differenzen:')
print ('        lat-differenz: ', lat_diff)
print ('        lon-differenz: ', lon_diff)

print ('    Kartenmitte:')
print ('        lon: ', lon_mid)
print ('        lat: ', lat_mid)

print ('    Wahl der Basemap:')
print ('        lon-Distanz:               ', round(lon_dist, 4), 'km')
print ('        Scalebar-Laenge:            ', scalebar_length, 'km')
print ('        optimale Pixelgroesse in \':  ', perfect_pixel_size)
print ('        optimale Pixelgroesse in km: ', pixel_km)
print ('        basemapsize in arc-min:    ', basemap_size)

print ('\n        Basemap:		   ', basemap)
print ('        Basemap Hillshade:         ', basemap_hillshade)

print ('\nOutput:')
print ('    Output-Datei:      ', output)