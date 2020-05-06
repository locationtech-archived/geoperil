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

coast_res=${2}

R=${3}
J=${4}

coast_res=${2}

#Anfang clip Land "-Gc"; "-D" fuer Aufloesung der Kuestenlinien
gmt pscoast -J -R -P -V -K -O -D${coast_res} -Gc -Y >> ${output}

#erstellt land mit hillshade
gmt grdimage -J -R -P -V -K -O -C Tsunami_report/cpt/world_population/world_pop3.cpt GMT/data/world_pop/world_pop2000_adj.nc -Y >> ${output}

#Ende Clip Land "-Q"
gmt pscoast -J -R -P -V -K -O -Q -Y >> ${output}
