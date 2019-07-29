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

quake=${2}

quake_fill=${3}

y_map_distance=${4}


#Mag < 5
awk "BEGIN {FS=\",\"}; \$3 < 5 {print \$1, \$2;}" ${quake} | gmt psxy -R -J -P -W0.01c,35/35/35 -i0,1 -Sa0.35c -G${quake_fill} -Ya${y_map_distance} -O -K >> ${output}
#Mag 5 - 7
awk "BEGIN {FS=\",\"}; \$3 >= 5 && \$3 < 7 {print \$1, \$2;}" ${quake} | gmt psxy -R -J -P -W0.01c,35/35/35  -i0,1 -Sa0.45c -G${quake_fill} -Ya${y_map_distance} -O -K >> ${output}
#Mag > 7
awk "BEGIN {FS=\",\"}; \$3 >= 7 {print \$1, \$2;}" ${quake} | gmt psxy -R -J -P -W0.01c,35/35/35  -i0,1 -Sa0.55c -G${quake_fill} -Ya${y_map_distance} -O -K >> ${output}
