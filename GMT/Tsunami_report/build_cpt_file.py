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


# color = R/G/B
def build_basemap_cpt(cpt_path, color):
    cpt_file = open(cpt_path, "w")
    cpt_file.write('# COLOR_MODEL = RGB\n')
    cpt_file.write('-11000\t' + color + '\t9000\t' + color)
    cpt_file.write('\nB\t255/255/255')
    cpt_file.write('\nF\t10/0/121')
    cpt_file.write('\nN\t128/128/128')

    cpt_file.close()
