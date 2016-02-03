#!/usr/bin/env python3
import os
import subprocess
import argparse
import math
import datetime
import re
import json
import tempfile, shutil

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

input_param = [
{"Flagname": "Title",              "variable": "title",                    "Flag1": "-t",            "Flag2": "--title",                   "default": "-None-",         "help": "Title for map", "user": True},
{"Flagname": "Subheading",         "variable": "subtitle",                 "Flag1": "-st",           "Flag2": "--subtitle",                "default": "-None-",         "help": "subheading for map", "user": True},
{"Flagname": "Output-Data",        "variable": "output",                   "Flag1": "-o",            "Flag2": "--output",                  "default": "/home/basti/GMT/Tsunami_report/PS_files/default_output.ps", "help": "Path of Output PS-File", "user": False},

{"Flagname": "West",               "variable": "west",                     "Flag1": "-e_w",          "Flag2": "--extent_west",             "default": None,             "help": "Extent West", "user": True},
{"Flagname": "East",               "variable": "east",                     "Flag1": "-e_e",          "Flag2": "--extent_east",             "default": None,             "help": "Extent East", "user": True},
{"Flagname": "South",              "variable": "south",                    "Flag1": "-e_s",          "Flag2": "--extent_south",            "default": None,             "help": "Extent South", "user": True},
{"Flagname": "North",              "variable": "north",                    "Flag1": "-e_n",          "Flag2": "--extent_north",            "default": None,             "help": "Extent North", "user": True},

{"Flagname": "Y-Ratio",            "variable": "y_ratio",                  "Flag1": "-y_r",          "Flag2": "--y_ratio",                 "default": "4",              "help": "Map-Frame-ratio for y-axis\n(default = 4)", "user": False},
{"Flagname": "X-Ratio",            "variable": "x_ratio",                  "Flag1": "-x_r",          "Flag2": "--x_ratio",                 "default": "5",              "help": "Map-Frame-ratio for x-axis\n(default = 5)", "user": False},

{"Flagname": "WaveJets",           "variable": "wave_height",              "Flag1": "-w_height",     "Flag2": "--wave_height",             "default": "",               "help": "Path to WaveJets-GRID-File", "user": False},
{"Flagname": "Wave-Expression",    "variable": "wave_height_expression",   "Flag1": "-w_exp",        "Flag2": "--wave_height_expression",  "default": "0.05",           "help": "All values above input will be plotted [m]", "user": True},
{"Flagname": "Plot WaveJets?",     "variable": "plot_wave_height",         "Flag1": "-p_w_height",   "Flag2": "--plot_wave_height",        "default": "N",              "help": "Plot WaveJets?\nYes = Y\nNo = N (default)", "user": True},
{"Flagname": "WaveJets CPT",       "variable": "wave_height_cpt",          "Flag1": "-w_height_cpt", "Flag2": "--wave_height_cpt",         "default": "cpt/wave_height/waveheight_1.cpt", "help": "Path to CPT-File for WaveJets", "user": False},

{"Flagname": "TravelTimes",        "variable": "wave_time",                "Flag1": "-w_time",       "Flag2": "--wave_time",               "default": "",               "help": "Path to TravelTimes-GRID-File", "user": False},
{"Flagname": "Plot TravelTimes?",  "variable": "plot_wave_time",           "Flag1": "-p_w_time",     "Flag2": "--plot_wave_time",          "default": "N",              "help": "Plot TravelTimes?\nYes = Y\nNo = N (default)", "user": True},
{"Flagname": "TravelTimes Color",  "variable": "Isochrone_color",          "Flag1": "-w_time_c",     "Flag2": "--wave_time_color",         "default": "red",            "help": "Color for TravelTimes (R/G/B)", "user": True},

{"Flagname": "CFZ",                "variable": "cfz",                      "Flag1": "-cfz",          "Flag2": "--cfz",                     "default": "",               "help": "Path to CFZ GMT-File", "user": False},
{"Flagname": "Plot CFZ?",          "variable": "plot_cfz",                 "Flag1": "-p_cfz",        "Flag2": "--plot_cfz",                "default": "N",              "help": "Plot Coastal-Forecast-Zones?\nYes = Y\nNo = N (default)", "user": True},
{"Flagname": "CFZ CPT",            "variable": "cfz_cpt",                  "Flag1": "-cfz_cpt",      "Flag2": "--cfz_cpt",                 "default": "cpt/CFZ/CFZ.cpt", "help": "Path to CPT-File for Coastal-Forecast-Zones", "user": False},
{"Flagname": "Color CFZ Stroke",   "variable": "cfz_stroke",               "Flag1": "-cfz_stroke",   "Flag2": "--cfz_stroke",              "default": "35/35/35",       "help": "Color for CFZ stroke (R/G/B)", "user": True},

{"Flagname": "TFP",                "variable": "tfp",                      "Flag1": "-tfp",          "Flag2": "--tfp",                     "default": "",               "help": "Path to TFP CSV-File", "user": False},
{"Flagname": "Plot TFP?",          "variable": "plot_tfp",                 "Flag1": "-p_tfp",        "Flag2": "--plot_tfp",                "default": "N",              "help": "Plot Tsunami-Forecast-Zones?\nYes = Y\nNo = N (default)", "user": True},
{"Flagname": "TFP CPT",            "variable": "tfp_cpt",                  "Flag1": "-tfp_cpt",      "Flag2": "--tfp_cpt",                 "default": "cpt/TFP/TFP.cpt", "help": "Path to CPT-File for Tsunami-Forecast-Points", "user": False},
{"Flagname": "Color TFP Stroke",   "variable": "tfp_stroke",               "Flag1": "-tfp_stroke",   "Flag2": "--tfp_stroke",              "default": "255/255/255",    "help": "Color for TFP stroke (R/G/B)", "user": True},

{"Flagname": "Quake",              "variable": "quake",                    "Flag1": "-q",            "Flag2": "--quake",                   "default": "",               "help": "Path to Qauke CSV-File", "user": False},
{"Flagname": "Plot Quake?",        "variable": "plot_quake",               "Flag1": "-p_q",          "Flag2": "--plot_quake",              "default": "N",              "help": "Plot Quake?\nYes = Y\nNo = N (default)", "user": True},
{"Flagname": "Color Quake",        "variable": "quake_fill",               "Flag1": "-q_f",          "Flag2": "--quake_fill",              "default": "252/255/0",      "help": "Fill color for quake (R/G/B)", "user": True},

{"Flagname": "Plot DEM?",          "variable": "dem",                      "Flag1": "-p_dem",        "Flag2": "--plot_dem",                "default": "N",              "help": "Plot DEM as basemap?\nYes = Y\nNo = N (default)", "user": True},
{"Flagname": "Plot DEM Water?",    "variable": "dem_water",                "Flag1": "-p_dem_w",      "Flag2": "--plot_dem_water",          "default": "N",              "help": "Plot DEM as basemap only for water?\n--plot_dem must be True!\nYes = Y\nNo = N (default)", "user": True},
{"Flagname": "Basemap water CPT",  "variable": "basemap_water_cpt",        "Flag1": "-w_cpt",        "Flag2": "--basemap_water_cpt",       "default": "cpt/basemap/blue.cpt", "help": "Path to CPT-File for water-basemap", "user": False},
{"Flagname": "Basemap land CPT",   "variable": "basemap_land_cpt",         "Flag1": "-l_cpt",        "Flag2": "--basemap_land_cpt",        "default": "cpt/basemap/brown.cpt", "help": "Path to CPT-File for land-basemap", "user": False},

{"Flagname": "Plot World Pop?",    "variable": "world_pop",                "Flag1": "-p_w_pop",      "Flag2": "--plot_world_pop",          "default": "N",              "help": "Plot World Population?\nYes = Y\nNo = N (default)", "user": True},
{"Flagname": "World Pop CPT",      "variable": "world_pop_cpt",            "Flag1": "-w_pop_cpt",    "Flag2": "--world_pop_cpt",           "default": "cpt/world_population/world_pop_label.cpt", "help": "Path to CPT-File for World Population", "user": False},

{"Flagname": "Plot Cities?",       "variable": "plot_cities",              "Flag1": "-p_c",          "Flag2": "--plot_cities",             "default": "N",              "help": "Plot Cities?\nYes = Y\nNo = N (default)", "user": True},
{"Flagname": "Cities Pop",         "variable": "cities_pop",               "Flag1": "-c_pop",        "Flag2": "--cities_pop",              "default": "0",              "help": "All Cities above given value will be plotted [mio]\n(default = 0)", "user": True},
{"Flagname": "Capital citites?",   "variable": "cities_capital",           "Flag1": "-c_c",          "Flag2": "--cities_capital",          "default": "N",              "help": "Plot only capital cities?\nYes = Y\nNo = N (default)", "user": True},
{"Flagname": "Label cities?",      "variable": "cities_label",             "Flag1": "-c_l",          "Flag2": "--cities_label",            "default": "N",              "help": "Label citites?\nYes = Y\nNo = N (default)", "user": True},
{"Flagname": "Label cities Pop",   "variable": "cities_label_pop",         "Flag1": "-c_l_p",        "Flag2": "--cities_label_pop",        "default": "N",              "help": "Cities above given value will be labelled [mio]\nIf no input -> all visible cities will be labelled", "user": True},
{"Flagname": "Color cities",       "variable": "cities_fill",              "Flag1": "-c_f",          "Flag2": "--cities_fill",             "default": "230/26/26",      "help": "Fill color for cities (R/G/B)", "user": True},
{"Flagname": "Color cities stroke","variable": "cities_stroke",            "Flag1": "-c_s",          "Flag2": "--cities_stroke",           "default": "58/0/0",         "help": "Color for cities stroke (R/G/B)", "user": True},

{"Flagname": "Plot map scale?",    "variable": "plot_map_scale",           "Flag1": "-p_ms",         "Flag2": "--plot_map_scale",          "default": "Y",              "help": "Plot map scale bar?\nYes = Y (default)\nNo = N", "user": True},
{"Flagname": "Plot globe?",        "variable": "plot_globe",               "Flag1": "-p_g",          "Flag2": "--plot_globe",              "default": "Y",              "help": "Plot overview-globe?\nYes = Y (default)\nNo = N", "user": True},
{"Flagname": "Globe land color",   "variable": "color_globe_land",         "Flag1": "-c_g_l",        "Flag2": "--color_globe_land",        "default": "173/209/166",    "help": "Color for land (overview-globe) (R/G/B)", "user": True},
{"Flagname": "Globe water color",  "variable": "color_globe_water",        "Flag1": "-c_g_w",        "Flag2": "--color_globe_water",       "default": "LightBlue",      "help": "Color for water (overview-globe) (R/G/B)", "user": True},
{"Flagname": "Globe grid color",   "variable": "color_globe_grid",         "Flag1": "-c_g_g",        "Flag2": "--color_globe_grid",        "default": "59/80/54",       "help": "Color for globe grid (overview-globe) (R/G/B)", "user": True},

{"Flagname": "Plot outline?",      "variable": "outline",                  "Flag1": "-p_o",          "Flag2": "--plot_outline",            "default": "N",              "help": "Plot outline (coast)?\nYes = Y\nNo = N (default)", "user": True},
{"Flagname": "Coastline Color",    "variable": "coast_color",              "Flag1": "-c_color",      "Flag2": "--coast_color",             "default": "60/60/60",       "help": "Color for coastlines (R/G/B)\n--plot_outline must be True!", "user": True},
{"Flagname": "Water color",        "variable": "color_water",              "Flag1": "-c_water",      "Flag2": "--color_water",             "default": "170/170/170",    "help": "Color for water (R/G/B)\n--plot_dem must be False or --plot_dem_water True!", "user": True},
{"Flagname": "Land color",         "variable": "color_land",               "Flag1": "-c_land",       "Flag2": "--color_land",              "default": "80/80/80",       "help": "Color for land (R/G/B)\n--plot_dem must be False!", "user": True},
{"Flagname": "Style",              "variable": "style",                    "Flag1": "-style",        "Flag2": "--style",                   "default": "",               "help": "Choose pre-built styles", "user": True},

{"Flagname": "JSON",               "variable": "print_json",               "Flag1": "-p_j",          "Flag2": "--print_json",              "default": None,             "help": "if = Y input printed as json", "user": False}
]

for x in input_param:
    if x["default"] is None:
        parser.add_argument(x["Flag1"], x["Flag2"], dest = x["variable"], help = x["help"])        
    else:
        parser.add_argument(x["Flag1"], x["Flag2"], dest = x["variable"], default = x["default"], help = x["help"])   

args = parser.parse_args()

###########################################################################################
############################## Tsunami Report Function ####################################
###########################################################################################
def tsunami_report(\
    title, subtitle, output, \
    west, east, south, north, \
    y_ratio, x_ratio, \
    wave_height, wave_height_expression, plot_wave_height, wave_height_cpt, \
    wave_time, plot_wave_time, Isochrone_color, \
    cfz, plot_cfz, cfz_cpt, cfz_stroke, \
    tfp, plot_tfp, tfp_cpt, tfp_stroke, \
    quake, plot_quake, quake_fill, \
    dem, dem_water, basemap_water_cpt, basemap_land_cpt, \
    world_pop, world_pop_cpt, \
    plot_cities, cities_pop, cities_capital, cities_label, cities_label_pop, cities_fill, cities_stroke, \
    plot_map_scale, plot_globe, color_globe_land, color_globe_water, color_globe_grid, \
    outline, coast_color, color_water, color_land, style, \
    basemap_data_dir, world_pop_data, city_pop_data, \
    crs_system, unit, map_width, coast_res, land_res, Isochrone_dist, \
    print_json, input_param):

    #prints input-list as json
    if print_json=="Y":
        print (json.dumps(input_param))
        return    
    
    tempdir = tempfile.mkdtemp()
    os.environ["GMT_TMPDIR"] = tempdir
    
    map_width = float(map_width)
    y_ratio = float(y_ratio)
    x_ratio = float(x_ratio)
    
    wave_height_temp = '%s/eWave_height_temp.nc' % (tempdir)
    wave_height_expression = float(wave_height_expression)
    if wave_height_expression <= 0:
        wave_height_expression = 0.00000000000000001
	
    wave_time_temp = '%s/eWave_time_temp.nc' %(tempdir)

    #aktuelles Datum
    date = datetime.datetime.utcnow().strftime("%Y, %B %d, %H:%M")

    print ('\nAll Input values:')
    print ('\tTitle:\t\t\t', title, '\n\tSubtitle:\t\t', subtitle, '\n\tOutput-File:\t\t', output, '\n')
    print ('\tWest:\t\t\t', west, '\n\tEast:\t\t\t', east, '\n\tSouth:\t\t\t', south, '\n\tNorth:\t\t\t', north, '\n')
    print ('\ty-ratio:\t\t', y_ratio, '\n\tx-ratio:\t\t', x_ratio, '\n')
    print ('\tplot WaveJets?:\t\t', plot_wave_height, '\n\tWaveJets:\t\t', wave_height, '\n\tWaveJets temp:\t\t', wave_height_temp, '\n\tWaveJets CPT:\t\t', wave_height_cpt, '\n\tw_exp:\t\t\t', wave_height_expression, '\n')   
    print ('\tplot TravelTimes?:\t', plot_wave_time, '\n\tTravelTimes:\t\t', wave_time, '\n\tTravelTimes temp:\t', wave_time_temp, '\n\tTravelTimes color:\t', Isochrone_color, '\n')              
    print ('\tplot CFZ?:\t\t', plot_cfz, '\n\tCFZ:\t\t\t', cfz, '\n\tCFZ CPT:\t\t', cfz_cpt, '\n\tCFZ stroke:\t\t', cfz_stroke, '\n')
    print ('\tplot TFP?:\t\t', plot_tfp, '\n\tTFP:\t\t\t', tfp, '\n\tTFP CPT:\t\t', tfp_cpt, '\n\tTFP stroke:\t\t', tfp_stroke, '\n')
    print ('\tplot quake?:\t\t', plot_quake, '\n\tquake:\t\t\t', quake, '\n\tquake fill:\t\t', quake_fill, '\n')
    print ('\tplot dem?:\t\t', dem, '\n\tplot dem water?:\t', dem_water, '\n\tbasemap water CPT:\t', basemap_water_cpt, '\n\tbasemap land CPT:\t', basemap_land_cpt, '\n')
    print ('\tplot world pop?:\t', world_pop, '\n\tworld pop CPT:\t\t', world_pop_cpt, '\n')
    print ('\tplot cities?:\t\t', plot_cities, '\n\tcities pop:\t\t', cities_pop, '\n\tcapital cities?:\t', cities_capital, '\n\tlabel cities?:\t\t', cities_label, '\n\tlabel cities pop:\t', cities_label_pop, '\n\tcities color:\t\t', cities_fill, '\n\tcities stroke:\t\t', cities_stroke, '\n')
    print ('\tplot map scale?:\t', plot_map_scale, '\n\tplot globe?:\t\t', plot_globe, '\n\tglobe land color\t', color_globe_land, '\n\tglobe water color:\t', color_globe_water, '\n\tglobe grid color:\t', color_globe_grid, '\n')
    print ('\tplot outline?:\t\t', outline, '\n\tcoast color:\t\t', coast_color, '\n\tcolor water:\t\t', color_water, '\n\tcolor land:\t\t', color_land, '\n\tstyle nr:\t\t', style, '\n')
    print ('\tbasemap data dir:\t', basemap_data_dir, '\n\tworld pop file:\t\t', world_pop_data, '\n\tcity pop file:\t\t', city_pop_data, '\n')
    print ('\tCRS system:\t\t', crs_system, '\n\tunit:\t\t\t', unit, '\n\tmap width:\t\t', map_width, '\n\tcoast res:\t\t', coast_res, '\n\tland res:\t\t', land_res, '\n\tIsochrone dist:\t\t', Isochrone_dist, '\n')

    print ('\n>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>    SCRIPT RUNNING!    <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<\n')

    ##############################################
    ################# Berechnungen ###############
    ##############################################

    ############################
    ##### pre-built styles #####
    ############################
    if style=="1":
        #DEM: land=brown; water=blue
        dem = 'Y'
        basemap_water_cpt = 'cpt/basemap/blue.cpt'
        basemap_land_cpt = 'cpt/basemap/brown.cpt'
    elif style=="2":
        #no DEM: land=darkgray; water=gray
        dem = 'N'
        outline = 'Y'
        land_res = '1000'
        coast_color = '215/215/215'
        color_water = '170/170/170'
        color_land = '80/80/80 -N1/0.01c,160/160/160 -N2/0.01c,90/90/90'
    elif style=="3":
        #water with DEM = gray; land no DEM = darkgray
        dem = 'Y'
        dem_water = 'Y'
        outline = 'Y'
        land_res = '1000'
        coast_color = '215/215/215'
        basemap_water_cpt = 'cpt/basemap/water_gray.cpt'
        color_land = '80/80/80 -N1/0.01c,160/160/160 -N2/0.01c,90/90/90'
    elif style=="4":
        #water with DEM = darkblue; land no DEM = darkgray
        dem = 'Y'
        dem_water = 'Y'
        outline = 'Y'
        land_res = '1000'
        coast_color = '215/215/215'
        basemap_water_cpt = 'cpt/basemap/blue2.cpt'
        color_land = '80/80/80 -N1/0.01c,160/160/160 -N2/0.01c,90/90/90'
    elif style=="5":
        dem = 'Y'
        outline = 'Y'
        land_res = '1000'
        coast_color = '220/220/220'
        basemap_water_cpt = 'cpt/basemap/blue2.cpt'
        basemap_land_cpt = 'cpt/basemap/land_gray2.cpt'
        



    ############################
    ## Kartenabstand (unten) ###
    ############################

    #berechnet Abstand zur unteren Blattkante, abhaengig von zu plottenden Inhalten
    y_map_dist = 1
    layer_list_count = [plot_wave_time, world_pop, plot_cities, plot_tfp, plot_cfz].count("Y")   
    layer_list_count_xwave = [world_pop, plot_cities, plot_tfp, plot_cfz].count("Y")   
         
    if  (plot_wave_height=="Y" and layer_list_count <= 0) or (plot_wave_height=="Y" and plot_wave_time=="Y" and layer_list_count_xwave <= 0):
        y_map_dist += 1.9  
    elif plot_wave_height=="Y" and layer_list_count >=1:
        y_map_dist += 3.8   
    elif plot_wave_height=="N" and layer_list_count >=1:    
        y_map_dist += 2.3
 
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
    #berechnet die optimale Ausdehnung anhand der Eingabe-Dateien (siehe auto_extent.px)
    west, east, south, north = best_auto_extent_for_input(west, east, south, north, wave_height, wave_height_expression, wave_time, cfz, tfp, tempdir)
    
    west = float(west)
    east = float(east)
    south = float(south)
    north = float(north)
    
    print ('Extent after input-calculation:')
    print (    'west:  ', west)
    print (    'east:  ', east)
    print (    'south: ', south)
    print (    'north: ', north)


    ############################
    ####### Kartenrahmen #######
    ############################


    #Berechnet automatisch die Groesse des Kartenrahmen
    #Funktion eingeladen aus auto_extent.py
    west, east, south, north, width, height, lon_diff, lat_diff = calc_coords(west, east, south, north, crs_system, map_width, unit, y_ratio, x_ratio, tempdir)


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
    ppi = 300

    #berechnet optimale Pixelgroesse in arc-minute
    one_inch_in_degree = lon_diff / (map_width / 2.54)
    perfect_pixel_size = (one_inch_in_degree / ppi) * 60
    #Pixelgroesse in Kilometer
    pixel_km = perfect_pixel_size * ((math.pi / 180) * 6370 / 60)

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
    #	outline coast_res coast_color terrain color_water color_land color_globe_land color_globe_water land_res basemap_water_cpt basemap_land_cpt
    subprocess.call(['./gmt_scripts/Basemap.sh', title,output , R, J, y_map_distance, basemap, basemap_hillshade, \
        outline, coast_res, coast_color, dem, color_water, color_land, color_globe_land, color_globe_water, land_res, basemap_water_cpt, basemap_land_cpt, \
        world_pop_data, world_pop_cpt, world_pop, subtitle, str(paper_height), dem_water])
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
        subprocess.call(['./gmt_scripts/TFP.sh',output ,tfp, tfp_0_03_fill, tfp_03_1_fill, tfp_1_3_fill, tfp_3_fill, tfp_cpt, tfp_stroke, y_map_distance])

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
        subprocess.call(['./gmt_scripts/Globus.sh', output, str(west), str(east), str(south), str(north), str(lon_mid), str(lat_mid), str(y_globe_dist), str(x_globe_dist), color_globe_land, color_globe_water, color_globe_grid])


    ######################################
    ############## Legende ###############
    ######################################

    ######## map scale ##########
    if plot_map_scale=="Y":
        subprocess.call(['./gmt_scripts/map_scale.sh', output, R, J, str(lon_mid), str(lat_mid), str(scalebar_length), y_map_distance])

    ########## Legende ##########
    if plot_cfz=="Y" or plot_tfp=="Y":
        plot_cfz_tfp = "Y"
    else:
        plot_cfz_tfp = "N"
    plot_legend_list = [plot_wave_height, plot_wave_time, world_pop, plot_cities, plot_cfz_tfp]

    wave_height_pslegend, wave_height_psscale, wave_time_pslegend, world_pop_pslegend, world_pop_psscale_1, world_pop_psscale_2, cities_pslegend, tfp_cfz_pslegend, tfp_cfz_psscale_1, tfp_cfz_psscale_2 = calc_legend_positions (plot_legend_list, y_map_dist)

    created_y = y_map_dist - 0.6

    subprocess.call(['./gmt_scripts/Legend.sh',output, plot_wave_height, plot_wave_time, world_pop, plot_cfz, plot_tfp, plot_cities, cfz_cpt, cfz_stroke, tfp_stroke, wave_height_cpt, world_pop_cpt, cities_fill, cities_stroke, \
        wave_height_pslegend, wave_height_psscale, wave_time_pslegend, tfp_cfz_pslegend, tfp_cfz_psscale_1, tfp_cfz_psscale_2, world_pop_pslegend, world_pop_psscale_1, world_pop_psscale_2, cities_pslegend, \
        str(created_y), str(map_width), date])
   
    ######################################
    ###### Umwandlung in PNG/PDF #########
    ######################################

    #PseudoCommand; beendet das Overlay; Plottet unsichtbare Fluesse/Seen
    #gmt pscoast -J -R -P -O -C-t100 -Y >> ${output}
    subprocess.call(['./gmt_scripts/pseudo_end.sh', output, R, J, tempdir])

    #erstellt png-Datei
    #gmt ps2raster default_output.ps -A -Tg -V
    #-A plottet nur Karteninhalt
    subprocess.call(['gmt', 'ps2raster', output, '-Tg', '-A', '-V', '-E300'], cwd=tempdir)
    #PDF
    #subprocess.call(['gmt', 'ps2raster', output, '-Tf', '-V'])

    #löscht tempdir
    shutil.rmtree(tempdir)

    ##################################################
    ################# INFO - Output ##################
    ##################################################
    print ('\n>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>    Finished!    <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<\n')

    print ('\nBerechnungen:')
    print ('    Ausdehnung / Kartenrahmen:')
    print ('        Breite (cm):                 ', width)
    print ('        Hoehe (cm):                  ', height)
    print ('\n        west:                        ', west)
    print ('        ost:                         ', east)
    print ('        nord:                        ', north)
    print ('        sued:                        ', south)

    print ('    lon/lat - Differenzen:')
    print ('        lat-differenz:               ', lat_diff)
    print ('        lon-differenz:               ', lon_diff)

    print ('    Kartenmitte:')
    print ('        lon:                         ', lon_mid)
    print ('        lat:                         ', lat_mid)

    print ('    Wahl der Basemap:')
    print ('        lon-Distanz:                 ', round(lon_dist, 4), 'km')
    print ('        Scalebar-Laenge:             ', scalebar_length, 'km')
    print ('        optimale Pixelgroesse in \':  ', perfect_pixel_size)
    print ('        optimale Pixelgroesse in km: ', pixel_km)
    print ('        basemapsize in arc-min:      ', basemap_size)

    print ('\n        Basemap:		     ', basemap)
    print ('        Basemap Hillshade:           ', basemap_hillshade)

    print ('\nOutput:')
    print ('    Output-Datei:      ', output, '\n')



##############################################################################################################
##############################################################################################################
##############################################################################################################
tsunami_report(\
    args.title, args.subtitle, args.output, \
    args.west, args.east, args.south, args.north, \
    args.y_ratio, args.x_ratio, \
    args.wave_height, args.wave_height_expression, args.plot_wave_height, args.wave_height_cpt, \
    args.wave_time, args.plot_wave_time, args.Isochrone_color, \
    args.cfz, args.plot_cfz, args.cfz_cpt, args.cfz_stroke, \
    args.tfp, args.plot_tfp, args.tfp_cpt, args.tfp_stroke, \
    args.quake, args.plot_quake, args.quake_fill, \
    args.dem, args.dem_water, args.basemap_water_cpt, args.basemap_land_cpt, \
    args.world_pop, args.world_pop_cpt, \
    args.plot_cities, args.cities_pop, args.cities_capital, args.cities_label, args.cities_label_pop, args.cities_fill, args.cities_stroke, \
    args.plot_map_scale, args.plot_globe, args.color_globe_land, args.color_globe_water, args.color_globe_grid, \
    args.outline, args.coast_color, args.color_water, args.color_land, args.style, \
    basemap_data_dir, world_pop_data, city_pop_data, \
    crs_system, unit, map_width, coast_res, land_res, Isochrone_dist, \
    args.print_json, input_param) 
