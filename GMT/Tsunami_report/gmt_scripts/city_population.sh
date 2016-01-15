#!/bin/bash

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


#plottet Städte abgestuft in drei Größen abhängig von cities_pop
if [ ${cities_pop} -le 1500000 ]
then
	#Pop = 0 bis 1.500.000
	awk "BEGIN {FS=\",\"}; \$29 >= ${cities_pop} && \$29 <= 1500000 ${cities_capital} {print \$1, \$2;}" ${city_pop_data} | gmt psxy ${R} ${J} -P -W0.01c,58/0/0 -i0,1,2 -Sc0.2c -G230/26/26 -Ya${y_map_dist} -O -K >> ${output}
	#Pop = 1.500.000 bis 3.000.000
	awk "BEGIN {FS=\",\"}; \$29 > 1500000 && \$29 <= 3000000 ${cities_capital} {print \$1, \$2;}" ${city_pop_data} | gmt psxy ${R} ${J} -P -W0.01c,58/0/0 -i0,1,2 -Sc0.25c -G230/26/26 -Ya${y_map_dist} -O -K >> ${output}
	#Pop > 3.000.000
	awk "BEGIN {FS=\",\"}; \$29 > 3000000 ${cities_capital} {print \$1, \$2;}" ${city_pop_data} | gmt psxy ${R} ${J} -P -W0.01c,58/0/0 -i0,1,2 -Sc0.3c -G230/26/26 -Ya${y_map_dist} -O -K >> ${output}
elif [ ${cities_pop} -le 3000000 ]
then
	#Pop = 1.500.000 bis 3.000.000
	awk "BEGIN {FS=\",\"}; \$29 > ${cities_pop} && \$29 <= 3000000 ${cities_capital} {print \$1, \$2;}" ${city_pop_data} | gmt psxy ${R} ${J} -P -W0.01c,58/0/0 -i0,1,2 -Sc0.2c -G230/26/26 -Ya${y_map_dist} -O -K >> ${output}
	#Pop > 3.000.000
	awk "BEGIN {FS=\",\"}; \$29 > 3000000 ${cities_capital} {print \$1, \$2;}" ${city_pop_data} | gmt psxy ${R} ${J} -P -W0.01c,58/0/0 -i0,1,2 -Sc0.3c -G230/26/26 -Ya${y_map_dist} -O -K >> ${output}
else
	#Pop > 3.000.000
	awk "BEGIN {FS=\",\"}; \$29 > ${cities_pop} ${cities_capital} {print \$1, \$2;}" ${city_pop_data} | gmt psxy ${R} ${J} -P -W0.01c,58/0/0 -i0,1,2 -Sc0.3c -G230/26/26 -Ya${y_map_dist} -O -K >> ${output}
fi


if [ ${cities_label} = Y ]
then
	awk "BEGIN {FS=\",\"}; \$29 > ${cities_label_pop} ${cities_capital} {print \$1, \$2, \$7;}" ${city_pop_data} | gmt pstext ${R} ${J} -F+f8p,Helvetica,black+jBL -Dj0.1c -Ya${y_map_dist} -O -K >> ${output}
fi
