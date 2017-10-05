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

output=${1}

R=${2}
J=${3}

y_map_dist=${4}

#city_pop_data="/home/basti/Schreibtisch/Tsunami_report/data/cities.csv"
city_pop_data=${5}

cities_pop=${6}
cities_capital=${7}

cities_label=${8}
cities_label_pop=${9}

cities_fill=${10}
cities_stroke=${11}


#plottet Staedte abgestuft in drei Groessen abhaengig von cities_pop
if [ ${cities_pop} -le 1500000 ]
then
	#Pop = 0 bis 1.500.000
	awk "BEGIN {FS=\",\"}; \$29 >= ${cities_pop} && \$29 <= 1500000 ${cities_capital} {print \$1, \$2;}" ${city_pop_data} | gmt psxy ${R} ${J} -P -W0.01c,${cities_stroke} -i0,1 -Sc0.2c -G${cities_fill} -t50 -Ya${y_map_dist} -O -K >> ${output}
	#Pop = 1.500.000 bis 3.000.000
	awk "BEGIN {FS=\",\"}; \$29 > 1500000 && \$29 <= 3000000 ${cities_capital} {print \$1, \$2;}" ${city_pop_data} | gmt psxy ${R} ${J} -P -W0.01c,${cities_stroke}  -i0,1 -Sc0.25c -G${cities_fill} -t50 -Ya${y_map_dist} -O -K >> ${output}
	#Pop > 3.000.000
	awk "BEGIN {FS=\",\"}; \$29 > 3000000 ${cities_capital} {print \$1, \$2;}" ${city_pop_data} | gmt psxy ${R} ${J} -P -W0.01c,${cities_stroke}  -i0,1 -Sc0.3c -G${cities_fill} -t50 -Ya${y_map_dist} -O -K >> ${output}
elif [ ${cities_pop} -le 3000000 ]
then
	#Pop = 1.500.000 bis 3.000.000
	awk "BEGIN {FS=\",\"}; \$29 > ${cities_pop} && \$29 <= 3000000 ${cities_capital} {print \$1, \$2;}" ${city_pop_data} | gmt psxy ${R} ${J} -P -W0.01c,${cities_stroke}  -i0,1 -Sc0.2c -G${cities_fill} -t50 -Ya${y_map_dist} -O -K >> ${output}
	#Pop > 3.000.000
	awk "BEGIN {FS=\",\"}; \$29 > 3000000 ${cities_capital} {print \$1, \$2;}" ${city_pop_data} | gmt psxy ${R} ${J} -P -W0.01c,${cities_stroke}  -i0,1 -Sc0.3c -G${cities_fill} -t50 -Ya${y_map_dist} -O -K >> ${output}
else
	#Pop > 3.000.000
	awk "BEGIN {FS=\",\"}; \$29 > ${cities_pop} ${cities_capital} {print \$1, \$2;}" ${city_pop_data} | gmt psxy ${R} ${J} -P -W0.01c,${cities_stroke}  -i0,1 -Sc0.3c -G${cities_fill} -t50 -Ya${y_map_dist} -O -K >> ${output}
fi

if [ ${cities_label} = Y ]
then
	awk "BEGIN {FS=\",\"}; \$29 > ${cities_label_pop} ${cities_capital} {print \$1, \$2, \$7;}" ${city_pop_data} | gmt pstext ${R} ${J} -F+f8p,Helvetica,black+jBL -Dj0.1c -Ya${y_map_dist} -O -K >> ${output}
fi
