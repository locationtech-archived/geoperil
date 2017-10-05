#!/bin/bash

# GeoPeril - A platform for the computation and web-mapping of hazard specific
# geospatial data, as well as for serving functionality to handle, share, and
# communicate threat specific information in a collaborative environment.
# 
# Copyright (C) 2013 GFZ German Research Centre for Geosciences
# 
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
# 
#   http://apache.org/licenses/LICENSE-2.0
# 
# Unless required by applicable law or agreed to in writing, software
# distributed under the Licence is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the Licence for the specific language governing permissions and
# limitations under the Licence.
# 
# Contributors:
# Sebastian Juengling (GFZ) - initial implementation
# Johannes Spazier (GFZ) - initial implementation
# Sven Reissland (GFZ) - initial implementation
# Martin Hammitzsch (GFZ) - initial implementation

#./Tsunami_wave_height.sh output wave_height_data wave_height_temp expression wave_height_cpt y_map_dist


#output=PS_files/test.ps
#wave_height_data=/home/basti/Schreibtisch/sf_Lubuntu_shared/GMT/data/tsunami/HDF600/eWave.2D.sshmax
#wave_height_temp=/home/basti/Schreibtisch/sf_Lubuntu_shared/GMT/data/tsunami/HDF600/eWave_height_temp.nc
#expression=0.05
#wave_height_cpt=cpt/waveheight_3.cpt

output=${1}
wave_height_data=${2}
wave_height_temp=${3}
expression=${4}
wave_height_cpt=${5}
y_map_dist=${6}

#Clipt grd nach Kriterien; -Sb alle Werte unter expression werden zu NaN
gmt grdclip ${wave_height_data} -G${wave_height_temp} -Sb${expression}/NaN -V

#runtime plot aus grd-datei "-nn+t0" wichtig fuer interpolation; "Q" fuer transparenz von nodata
gmt grdimage ${wave_height_temp} -J -R -P -C${wave_height_cpt} -t20 -V -Q -nn -Ya${y_map_dist} -K -O >> ${output}
#gmt grdimage ${wave_height_temp} -J -R -P -B -C${wave_height_cpt} -V -Q -nn -Ya${y_map_dist} -K -O >> ${output}


rm ${wave_height_temp}
