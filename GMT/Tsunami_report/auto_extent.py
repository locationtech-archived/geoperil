#!/usr/bin/env python3

import subprocess


#falls der Kartenausschnit über die Datumsgrenze (180°) geht müssen die Koordinaten umgewandelt werden
#z.B. west_calc=170; east_calc=-170 --> west_calc=170; east_calc=190
def reformat_coords_if_dateline(west_calc, east_calc, south_calc, north_calc):
    if west_calc > east_calc:
        #falls über Datumsgrenze
        add_east_calc = abs((-180) - east_calc)
        east_calc = float(180 + add_east_calc)
    
        lon_diff = abs(west_calc - east_calc)
        lat_diff = abs(south_calc - north_calc)
    else:
        lon_diff = abs(west_calc - east_calc)
        lat_diff = abs(south_calc - north_calc)
    
    return (west_calc, east_calc, lon_diff, lat_diff)    	

#Berechnet automatisch den Kartenrahmen nach Eingabe der Koordinaten und des Seitenverhältnisses
def calc_coords(west_calc, east_calc, south_calc, north_calc, crs_system_calc, map_width_calc, unit_calc, y_ratio_calc, x_ratio_calc):
    #Wandelt Koordinaten die über die Datumsgrenze gehen um
    west_calc, east_calc, lon_diff, lat_diff = reformat_coords_if_dateline(west_calc, east_calc, south_calc, north_calc)

    extent = '-R%s/%s/%s/%s' % (west_calc, east_calc, south_calc, north_calc)
    projection = '-J%s%s%s' % (crs_system_calc, map_width_calc, unit_calc)

    #Command zum Ausgeben der Höhe und Breite der Karte
    #echo $east_calc $north_calc | gmt mapproject -R${west_calc}/${east_calc}/${south_calc}/${north_calc} -J${crs_system_calc}${map_width_calc}c

    #berechnet breite und höhe der karte in unit_calc; führt oberen Command aus
    #entspricht z.B.: gmt mapproject -R-60/5/30/60 -JQ15.8c   
    calc_width_height_command = ['gmt', 'mapproject', extent, projection]
    mapproject = subprocess.Popen(calc_width_height_command, stdin=subprocess.PIPE, stdout=subprocess.PIPE)
    #bytes("%f %f\n" % (east_calc,north_calc),"ascii") = echo east_calc north_calc 
    width_height = mapproject.communicate(bytes("%f %f\n" % (east_calc,north_calc),"ascii"))[0].decode().split()

    #Breite und Höhe der Karte in unit_calc (z.B. cm)
    width = float(width_height[0])
    height = float(width_height[1])

    #entspricht z.B.: gmt mapproject -JQ15.8c -R-60/5/30/60 -Dc -I
    calc_coords_command = ['gmt', 'mapproject', projection, extent, '-D%s' % unit_calc, '-I']

    #entspricht ungefähr: if width < height:
    if (height / width) > (y_ratio_calc / x_ratio_calc):
        #berechnet den Zuschlag für die X-Achse für west_calc und Ost
        width_add = (((height * x_ratio_calc) / y_ratio_calc) - width) / 2
        west_calc_unit_calc = width_add * (-1)
        east_calc_unit_calc =  width + width_add
    
        #Berechnet östliche Koordinate anhand der eben berechneten Verbesserung
        calc_west_calc = subprocess.Popen(calc_coords_command, stdin=subprocess.PIPE, stdout=subprocess.PIPE)
        west_calc = calc_west_calc.communicate(bytes("%f %f\n" % (west_calc_unit_calc,height),"ascii"))[0].decode().split()
        west_calc = round(float(west_calc[0]),2)
    
        #Berechnet westliche Koordinate anhand der eben berechneten Verbesserung
        calc_east_calc = subprocess.Popen(calc_coords_command, stdin=subprocess.PIPE, stdout=subprocess.PIPE)
        east_calc = calc_east_calc.communicate(bytes("%f %f\n" % (east_calc_unit_calc,height),"ascii"))[0].decode().split()
        east_calc = round(float(east_calc[0]),2)
    
    #entspricht ungefähr: elif width > height:
    elif (height / width) < (y_ratio_calc / x_ratio_calc):
        #berechnet den Zuschlag für die Y-Achse für Nord und Süd
        height_add = (((width * y_ratio_calc) / x_ratio_calc) - height) / 2
        south_calc_unit_calc = height_add * (-1)
        north_calc_unit_calc = height + height_add
        
	#Berechnet südliche Koordinate anhand der eben berechneten Verbesserung
        calc_south_calc = subprocess.Popen(calc_coords_command, stdin=subprocess.PIPE, stdout=subprocess.PIPE)
        south_calc = calc_south_calc.communicate(bytes("%f %f\n" % (width,south_calc_unit_calc),"ascii"))[0].decode().split()  
        south_calc = round(float(south_calc[1]),2)
    
        #Berechnet nördliche Koordinate anhand der eben berechneten Verbesserung
        calc_north_calc = subprocess.Popen(calc_coords_command, stdin=subprocess.PIPE, stdout=subprocess.PIPE)
        north_calc = calc_north_calc.communicate(bytes("%f %f\n" % (width,north_calc_unit_calc),"ascii"))[0].decode().split() 
        north_calc = round(float(north_calc[1]),2)
    #else:
    #     Koordinaten sind so perfekt, dass sie genau das Seitenverhältnis abdecken
    
    #Wandelt Koordinaten die über die Datumsgrenze gehen um, da dieses wieder durch die Berechungen umgerechnet wurden
    west_calc, east_calc, lon_diff, lat_diff = reformat_coords_if_dateline(west_calc, east_calc, south_calc, north_calc)

    #gibt neue Höhe und Breite aus:
    extent = '-R%s/%s/%s/%s' % (west_calc, east_calc, south_calc, north_calc)
    mapproject = subprocess.Popen(['gmt', 'mapproject', extent, projection], stdin=subprocess.PIPE, stdout=subprocess.PIPE)
    width_height = mapproject.communicate(bytes("%f %f\n" % (east_calc,north_calc),"ascii"))[0].decode().split()

    width = float(width_height[0])
    height = float(width_height[1])

    return (west_calc, east_calc, south_calc, north_calc, width, height, lon_diff, lat_diff)


