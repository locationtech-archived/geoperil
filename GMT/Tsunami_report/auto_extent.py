#!/usr/bin/env python3

import subprocess
import re




######################################
######## calc wave height extent #####
######################################
def get_maxmin_wave_height(wave_height):
    wave_height_info = subprocess.Popen(['gdalinfo', wave_height, '-mm'], stdout=subprocess.PIPE).stdout.read().decode("utf-8")
    wave_height_max = re.findall("Min/Max=(-?\d+.\d+),(-?\d+.\d+)",wave_height_info)
    wave_height_max = float(wave_height_max[0][1])
    
    return wave_height_max

#Falls keine/oder nicht vollstaendige Ausdehnung eingegeben wird, wird die Ausdehnung automatisch anhand des Tsunami-GRIDs und w_exp berechnet
def calc_extent_for_w_height(wave_height, wave_height_expression, extent, tempdir):

    #Calc Extent wave heigt V1
    #if (west is None) or (east is None) or (north is None) or (south is None):
    temp_extent_file1 = '%s/contour.shp' % tempdir
    temp_extent_file2 = '%s/contour.dbf' % tempdir
    temp_extent_file3 = '%s/contour.shx' % tempdir

    subprocess.call(['gdal_contour', '-i', '1000', '-off', str(wave_height_expression), wave_height, temp_extent_file1])
    extent_info = subprocess.Popen(['ogrinfo', '-al', '-so', temp_extent_file1], stdout=subprocess.PIPE).stdout.read().decode("utf-8")

    subprocess.call(['rm', temp_extent_file1])
    subprocess.call(['rm', temp_extent_file2])
    subprocess.call(['rm', temp_extent_file3])
    
    extent_w_height = re.findall("\((-?\d+.\d+), (-?\d+.\d+)\)", extent_info)

    extent[0].append(float(extent_w_height[0][0]))
    extent[1].append(float(extent_w_height[1][0]))
    extent[2].append(float(extent_w_height[0][1]))
    extent[3].append(float(extent_w_height[1][1]))
    
    return (extent)
    
#########################################
####### calc wave time extent ###########
#########################################
#Falls keine/oder nicht vollstaendige Ausdehnung eingegeben wird, wird die Ausdehnung automatisch anhand des Tsunami-Traveltime-GRIDs berechnet
def calc_extent_for_w_time(wave_time, extent, tempdir):
    #Calc Extent wave time 
    temp_calc_tif='%s/calc_temp.tif' % (tempdir)
    temp_calc_gmt='%s/calc_temp.gmt' % (tempdir)
    #if (west is None) or (east is None) or (north is None) or (south is None):
        #entnimmt dem traveltime-GRID den hoechsten Z-Wert
    wave_time_info = subprocess.Popen(['gdalinfo', wave_time, '-mm'], stdout=subprocess.PIPE).stdout.read().decode("utf-8")
    wave_time_max = re.findall("Min/Max=(-?\d+.\d+),(-?\d+.\d+)",wave_time_info)
    wave_time_max = float(wave_time_max[0][1])
        #4/5 des maximalen Z-Wertes:
    wave_time_max_extent = int(wave_time_max * 0.8)
        
        #berechnet automatisch maximalste Ausdehnung des Traveltime-GRIDs fuer alle Z-Werte unter wave_time_max_extent
    subprocess.call(['gdal_calc.py', '-A', wave_time, '--outfile=%s' % temp_calc_tif, '--calc=logical_and(A>=0.0000001, A<=%s)' % (wave_time_max_extent)]) 
    subprocess.call(['gdal_polygonize.py', temp_calc_tif, '-f', 'GMT', temp_calc_gmt])
        #liest die GMT-File ien und speichert die zweite Zeile
    gmt_file = open(temp_calc_gmt)
    extent_line = gmt_file.readlines()[1]
	#liest die Koordinaten fuer die Ausdehnung aus der zweiten Zeile der GMT-File
    extent_w_time = re.findall("(-?\d+.\d+)",extent_line)
        
    subprocess.call(['rm', temp_calc_tif])
    subprocess.call(['rm', temp_calc_gmt])

    extent[0].append(float(extent_w_time[0]))
    extent[1].append(float(extent_w_time[1]))
    extent[2].append(float(extent_w_time[2]))
    extent[3].append(float(extent_w_time[3]))

    return (extent)

####################################
######## calc cfz extent ###########
####################################
def cfz_extent(cfz, extent):
    cfz_gmt_file = open(cfz)
    cfz_extent_line = cfz_gmt_file.readlines()[1]
	#liest die Koordinaten fuer die Ausdehnung aus der zweiten Zeile der GMT-File
    extent_cfz = re.findall("(-?\d+.\d+)",cfz_extent_line)

    extent[0].append(float(extent_cfz[0]))
    extent[1].append(float(extent_cfz[1]))
    extent[2].append(float(extent_cfz[2]))
    extent[3].append(float(extent_cfz[3]))

    return (extent)


####################################
######### calc tfp extent ##########
####################################	
def tfp_extent(tfp, extent):
    tfp_csv = open(tfp).readlines()[1:]
    
    tfp_lon_list = []
    tfp_lat_list = []
    tfp_extent = [None, None, None, None]
    for line in tfp_csv:
        r = line.split(",")
        if float(r[3]) >= 0:
            tfp_lon_list.append(float(r[0]))
            tfp_lat_list.append(float(r[1]))
    if not tfp_lon_list==[]: 	    
        if min(tfp_lon_list) != max(tfp_lon_list):
            tfp_extent[0] = min(tfp_lon_list)
            tfp_extent[1] = max(tfp_lon_list)
    if not tfp_lat_list==[]: 
        if min(tfp_lat_list) != max(tfp_lat_list):
            tfp_extent[2] = min(tfp_lat_list)
            tfp_extent[3] = max(tfp_lat_list)
       
    if tfp_extent[0] or tfp_extent[1] or tfp_extent[2] or tfp_extent[3]:
        extent[0].append(float(tfp_extent[0]))
        extent[1].append(float(tfp_extent[1]))
        extent[2].append(float(tfp_extent[2]))
        extent[3].append(float(tfp_extent[3]))
            
    return extent   

###########################################
######### combine calc extent #############
###########################################
def best_auto_extent_for_input(west, east, south, north, wave_height, wave_height_expression, wave_time, cfz, tfp, tempdir):
    if (west is None) or (east is None) or (north is None) or (south is None): 
        # extent = [[west],[east],[south],[north]] 
        extent = [[],[],[],[]]

        if not wave_height=='': 
            wave_height_max = get_maxmin_wave_height(wave_height)
            if wave_height_expression < wave_height_max:   
                extent = calc_extent_for_w_height(wave_height, wave_height_expression, extent, tempdir)
            else:
                extent = calc_extent_for_w_time(wave_time, extent, tempdir)	
        elif not wave_time=='':
            extent = calc_extent_for_w_time(wave_time, extent, tempdir)

        if not cfz=='':
            extent = cfz_extent(cfz, extent)
 
        if not tfp=='':
            extent = tfp_extent(tfp, extent)     
   
        print (extent)   
        if west is None:
            west = min(extent[0])
        if east is None:
            east = max(extent[1])
        if south is None:
           south = min(extent[2])
        if north is None:
            north = max(extent[3])
	
    return (west, east, south, north)



######################################################################################################################
#Funktionen zur automatischen Berechnung der Groesse des Kartenrahmes anhand Eingabe-Koords sowie x_ratio und y_ratio#
######################################################################################################################

#falls der Kartenausschnit ueber die Datumsgrenze (180°) geht muessen die Koordinaten umgewandelt werden
#z.B. west_calc=170; east_calc=-170 --> west_calc=170; east_calc=190
def reformat_coords_if_dateline(west_calc, east_calc, south_calc, north_calc):
    if west_calc > east_calc:
        #falls ueber Datumsgrenze
        add_east_calc = abs((-180) - east_calc)
        east_calc = float(180 + add_east_calc)
    
        lon_diff = abs(west_calc - east_calc)
        lat_diff = abs(south_calc - north_calc)
    else:
        lon_diff = abs(west_calc - east_calc)
        lat_diff = abs(south_calc - north_calc)
    
    return (west_calc, east_calc, lon_diff, lat_diff)    	

#Berechnet automatisch den Kartenrahmen nach Eingabe der Koordinaten und des Seitenverhaeltnisses
def calc_coords(west_calc, east_calc, south_calc, north_calc, crs_system_calc, map_width_calc, unit_calc, y_ratio_calc, x_ratio_calc, tempdir):
    #Wandelt Koordinaten die ueber die Datumsgrenze gehen um
    west_calc, east_calc, lon_diff, lat_diff = reformat_coords_if_dateline(west_calc, east_calc, south_calc, north_calc)

    extent = '-R%s/%s/%s/%s' % (west_calc, east_calc, south_calc, north_calc)
    projection = '-J%s%s%s' % (crs_system_calc, map_width_calc, unit_calc)

    #Command zum Ausgeben der Hoehe und Breite der Karte
    #echo $east_calc $north_calc | gmt mapproject -R${west_calc}/${east_calc}/${south_calc}/${north_calc} -J${crs_system_calc}${map_width_calc}c

    #berechnet breite und hoehe der karte in unit_calc; fuehrt oberen Command aus
    #entspricht z.B.: gmt mapproject -R-60/5/30/60 -JQ15.8c   
    calc_width_height_command = ['gmt', 'mapproject', extent, projection]
    mapproject = subprocess.Popen(calc_width_height_command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, cwd=tempdir)
    #bytes("%f %f\n" % (east_calc,north_calc),"ascii") = echo east_calc north_calc 
    width_height = mapproject.communicate(bytes("%f %f\n" % (east_calc,north_calc),"ascii"))[0].decode().split()

    #Breite und Hoehe der Karte in unit_calc (z.B. cm)
    width = float(width_height[0])
    height = float(width_height[1])

    #entspricht z.B.: gmt mapproject -JQ15.8c -R-60/5/30/60 -Dc -I
    calc_coords_command = ['gmt', 'mapproject', projection, extent, '-D%s' % unit_calc, '-I']

    #entspricht ungefaehr: if width < height:
    if (height / width) > (y_ratio_calc / x_ratio_calc):
        #berechnet den Zuschlag fuer die X-Achse fuer west_calc und Ost
        width_add = (((height * x_ratio_calc) / y_ratio_calc) - width) / 2
        west_calc_unit_calc = width_add * (-1)
        east_calc_unit_calc =  width + width_add
    
        #Berechnet oestliche Koordinate anhand der eben berechneten Verbesserung
        calc_west_calc = subprocess.Popen(calc_coords_command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, cwd=tempdir)
        west_calc = calc_west_calc.communicate(bytes("%f %f\n" % (west_calc_unit_calc,height),"ascii"))[0].decode().split()
        west_calc = round(float(west_calc[0]),2)
    
        #Berechnet westliche Koordinate anhand der eben berechneten Verbesserung
        calc_east_calc = subprocess.Popen(calc_coords_command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, cwd=tempdir)
        east_calc = calc_east_calc.communicate(bytes("%f %f\n" % (east_calc_unit_calc,height),"ascii"))[0].decode().split()
        east_calc = round(float(east_calc[0]),2)
    
    #entspricht ungefaehr: elif width > height:
    elif (height / width) < (y_ratio_calc / x_ratio_calc):
        #berechnet den Zuschlag fuer die Y-Achse fuer Nord und Sued
        height_add = (((width * y_ratio_calc) / x_ratio_calc) - height) / 2
        south_calc_unit_calc = height_add * (-1)
        north_calc_unit_calc = height + height_add
        
	#Berechnet suedliche Koordinate anhand der eben berechneten Verbesserung
        calc_south_calc = subprocess.Popen(calc_coords_command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, cwd=tempdir)
        south_calc = calc_south_calc.communicate(bytes("%f %f\n" % (width,south_calc_unit_calc),"ascii"))[0].decode().split()  
        south_calc = round(float(south_calc[1]),2)
    
        #Berechnet noerdliche Koordinate anhand der eben berechneten Verbesserung
        calc_north_calc = subprocess.Popen(calc_coords_command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, cwd=tempdir)
        north_calc = calc_north_calc.communicate(bytes("%f %f\n" % (width,north_calc_unit_calc),"ascii"))[0].decode().split() 
        north_calc = round(float(north_calc[1]),2)
    #else:
    #     Koordinaten sind so perfekt, dass sie genau das Seitenverhaeltnis abdecken
    
    #Wandelt Koordinaten die ueber die Datumsgrenze gehen um, da dieses wieder durch die Berechungen umgerechnet wurden
    west_calc, east_calc, lon_diff, lat_diff = reformat_coords_if_dateline(west_calc, east_calc, south_calc, north_calc)

    #gibt neue Hoehe und Breite aus:
    extent = '-R%s/%s/%s/%s' % (west_calc, east_calc, south_calc, north_calc)
    mapproject = subprocess.Popen(['gmt', 'mapproject', extent, projection], stdin=subprocess.PIPE, stdout=subprocess.PIPE, cwd=tempdir)
    width_height = mapproject.communicate(bytes("%f %f\n" % (east_calc,north_calc),"ascii"))[0].decode().split()

    width = float(width_height[0])
    height = float(width_height[1])
    #print (west_calc, east_calc, south_calc, north_calc, width, height, lon_diff, lat_diff)
    #print (tempdir)     
    return (west_calc, east_calc, south_calc, north_calc, width, height, lon_diff, lat_diff)


