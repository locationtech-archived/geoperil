#!/usr/bin/env python3

'''
   GeoPeril - A platform for the computation and web-mapping of hazard specific
   geospatial data, as well as for serving functionality to handle, share, and
   communicate threat specific information in a collaborative environment.
   
   Copyright (C) 2013 GFZ German Research Centre for Geosciences
   
   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at
   
     http://apache.org/licenses/LICENSE-2.0
   
   Unless required by applicable law or agreed to in writing, software
   distributed under the Licence is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the Licence for the specific language governing permissions and
   limitations under the Licence.
   
   Contributors:
   Sebastian Juengling (GFZ) - initial implementation
   Johannes Spazier (GFZ) - initial implementation
   Sven Reissland (GFZ) - initial implementation
   Martin Hammitzsch (GFZ) - initial implementation
'''

###############
# Input-Daten #
###############

#Basemap Daten Directory
#basemap_data_dir = 'data/etopo/basemaps/'
#basemap_data_dir = '/home/svenr/geohazardcloud/GMT/basemaps/'
basemap_data_dir = '/home/basti/Schreibtisch/sf_Lubuntu_shared/GMT/data/etopo/basemaps/'

#World-Population Datei
world_pop_data = 'data/world_pop2000_adj.nc'

#City-Population Datei
city_pop_data = 'data/cities.csv'


############################
######### Karte ############
############################

disclaimer = "This product is of informal nature, has been produced for piloting and research purposes only, and might be incorrect in terms of accuracy, completeness, quality, topicality, or otherwise, of the provided information. It does not constitute either legal, professional or any other advice or an endorsement or a recommendation, and should not be considered to be such, or relied or acted upon in that regard. This product is provided 'as is', without warranty of any kind, expressed or implied. The parties and individuals involved in producing and providing this product should not be held responsible or liable under any condition for any claim, damage or other liability arising from, out of or in connection with the product or the use or other dealings with the product and its information. By using this product, the user agrees that the use of information obtained from or through this product is at the user's sole discretion and risk. Complete information concerning the terms and conditions applied for this product are available at http://trideccloud.gfz-potsdam.de/disclaimer"
disclaimer_height = 2.5

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

