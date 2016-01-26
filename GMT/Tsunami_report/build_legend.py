#!/usr/bin/env python3

import math

def legend_order (world_pop, city_pop, plot_wave_time):
    world_pop_pslegend_x, world_pop_psscale_x_1, world_pop_psscale_x_2, city_pop_pslegend_x, wave_time_x = 0, 0, 0, 0, 0

    if world_pop=="Y" and city_pop=="Y" and plot_wave_time=="Y":
        #wave_time, city_pop und world_pop auf einer Ebene
        world_pop_pslegend_x = 0.2
        world_pop_psscale_x_1 = 0.2
        world_pop_psscale_x_2 = 2.2
        city_pop_pslegend_x = 6.3
        wave_time_x = 11.0
    elif world_pop=="Y" and city_pop=="Y" and plot_wave_time=="N":
        #world_pop und city_pop in einer Ebene
        world_pop_pslegend_x = 2.2
        world_pop_psscale_x_1 = 2.2
        world_pop_psscale_x_2 = 4.2
        city_pop_pslegend_x = 9.8
    elif world_pop=="Y" and city_pop=="N" and plot_wave_time=="Y":
        #world_pop und wave_time in einer Ebene
        world_pop_pslegend_x = 2.2
        world_pop_psscale_x_1 = 2.2
        world_pop_psscale_x_2 = 4.2
        wave_time_x = 9.3
    elif world_pop=="Y" and city_pop=="N" and plot_wave_time=="N":
        #nur world_pop
        world_pop_pslegend_x = 6.2
        world_pop_psscale_x_1 = 6.2
        world_pop_psscale_x_2 = 8.2
    elif world_pop=="N" and city_pop=="Y" and plot_wave_time=="Y":
        #city_pop und wave_time in einer Ebene
        city_pop_pslegend_x = 2.2
        wave_time_x = 9.3
    elif world_pop=="N" and city_pop=="Y" and plot_wave_time=="N":
        #nur city_pop
        city_pop_pslegend_x = 6.3
    elif world_pop=="N" and city_pop=="N" and plot_wave_time=="Y":
        #nur wave_time
        wave_time_x = 5.9
    return (wave_time_x, world_pop_pslegend_x, world_pop_psscale_x_1, world_pop_psscale_x_2, city_pop_pslegend_x)




def calc_legend_positions (world_pop, city_pop, plot_wave_time, plot_wave_height, y_map_dist):
    wave_height_pslegend_x, wave_height_psscale_x, wave_height_psscale_length = 0, 0, 0
    world_pop_pslegend_x, world_pop_psscale_x_1, world_pop_psscale_x_2, city_pop_pslegend_x, wave_time_x = 0, 0, 0, 0, 0    
    #Y-Position der Legendbestandteile
    wave_height_pslegend_y = float(y_map_dist)-1.8
    wave_height_psscale_y = float(y_map_dist)-1.5
    wave_time_y = float(y_map_dist)-2.3
    world_pop_pslegend_y = float(y_map_dist)-1.8
    world_pop_psscale_y = float(y_map_dist)-2.15
    city_pop_pslegend_y = float(y_map_dist)-3.0
    
    if plot_wave_height=="Y" and plot_wave_time=="N" and city_pop=="N" and world_pop=="N":
        #scalebar ueber volle laenge
        wave_height_pslegend_x = 6.5
        wave_height_psscale_x = 7.9
        wave_height_psscale_length = 12
    elif plot_wave_height=="Y" and plot_wave_time=="Y" and city_pop=="N" and world_pop=="N":
        #scalebar und traveltime auf einer ebene
        wave_height_pslegend_x = 3.5
        wave_height_psscale_x = 4.9
        wave_height_psscale_length = 8.0
        wave_time_x = 10.8
    elif plot_wave_height=="Y" and plot_wave_time=="N" and city_pop=="Y" and world_pop=="N":
        #scalebar und city_pop auf einer ebene
        wave_height_pslegend_x = 3.5
        wave_height_psscale_x = 4.9
        wave_height_psscale_length = 8.0    
        city_pop_pslegend_x = 10.8
    elif plot_wave_height=="Y" and plot_wave_time=="N" and city_pop=="N" and world_pop=="Y":   
        #scalebar und world_pop auf einer ebene 
        wave_height_pslegend_x = 3.5
        wave_height_psscale_x = 4.9
        wave_height_psscale_length = 8.0
        world_pop_pslegend_x = 10.3
        world_pop_psscale_x_1 = 10.3
        world_pop_psscale_x_2 = 12.3
    elif plot_wave_height=="Y" and (plot_wave_time=="Y" or city_pop=="Y" or world_pop=="Y"):
        #scalebar lang und wave_time, city_pop und world_pop auf einer ebene
        wave_height_pslegend_x = 6.5
        wave_height_psscale_x = 7.9
        wave_height_psscale_length = 12 
        wave_time_x, world_pop_pslegend_x, world_pop_psscale_x_1, world_pop_psscale_x_2, city_pop_pslegend_x = legend_order(world_pop, city_pop, plot_wave_time)
        world_pop_pslegend_y -= 2.2
        world_pop_psscale_y -= 2.2
        city_pop_pslegend_y -= 2.2
        wave_time_y -= 2.2
    else:
        #nur wave_time, city_pop und world_pop auf einer ebene
        wave_time_x, world_pop_pslegend_x, world_pop_psscale_x_1, world_pop_psscale_x_2, city_pop_pslegend_x = legend_order(world_pop, city_pop, plot_wave_time)

    wave_height_legend = [wave_height_pslegend_x, wave_height_pslegend_y, wave_height_psscale_x, wave_height_psscale_y, wave_height_psscale_length]
    wave_time_legend = [wave_time_x, wave_time_y] 
    world_pop_legend = [world_pop_pslegend_x, world_pop_pslegend_y, world_pop_psscale_x_1, world_pop_psscale_x_2, world_pop_psscale_y]
    city_pop_legend = [city_pop_pslegend_x, city_pop_pslegend_y]
    legend_positions = [wave_height_legend, wave_time_legend, world_pop_legend, city_pop_legend]

    return (legend_positions)