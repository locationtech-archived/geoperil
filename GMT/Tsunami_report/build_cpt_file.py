#!/usr/bin/env python3

#color = R/G/B
def build_basemap_cpt(cpt_path, color):
    cpt_file = open(cpt_path, "w")
    cpt_file.write('# COLOR_MODEL = RGB\n')
    cpt_file.write('-11000\t' + color + '\t9000\t' + color)
    cpt_file.write('\nB\t255/255/255')
    cpt_file.write('\nF\t10/0/121')
    cpt_file.write('\nN\t128/128/128') 
    
    cpt_file.close()        

#build_basemap_cpt('/home/basti/GMT/Tsunami_report/test.cpt', '90/130/153')    
   