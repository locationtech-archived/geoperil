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

tfp=${2}

tfp_cpt=${3}

tfp_stroke=${4}

y_map_distance=${5}


awk "BEGIN {FS=\",\"}; \$4 < 0 {print \$1, \$2;}" ${tfp} | gmt psxy -R -J -P -W0.02c,${tfp_stroke} -i0,1 -Sc0.13c -G150/150/150 -t25 -Ya${y_map_distance} -O -V -K >> ${output}


awk "BEGIN {FS=\",\"}; \$4 >= 0 {print \$1, \$2, \$3;}" ${tfp} | gmt psxy -R -J -P -W0.02c,${tfp_stroke} -i0,1,2 -Sc0.13c -C${tfp_cpt} -Ya${y_map_distance} -O -V -K >> ${output}
