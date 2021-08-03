<!--
GeoPeril - A platform for the computation and web-mapping of hazard
specific geospatial data, as well as for serving functionality to handle,
share, and communicate threat specific information in a collaborative
environment.

Copyright (C) 2021 GFZ German Research Centre for Geosciences

SPDX-License-Identifier: Apache-2.0

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
  Johannes Spazier (GFZ)
  Sven Reissland (GFZ)
  Martin Hammitzsch (GFZ)
  Matthias Rüster (GFZ)
  Hannes Fuchs (GFZ)
-->

# GeoPeril

## Development environment

To start up a development environment use the `docker-compose-dev.yml` file:

```shell
cd docker
docker-compose -f docker-compose-dev.yml up --build
```

You can then visit `http://localhost:8080` to see the frontend.

Changes for the source code of the frontend component are then hot reloaded and
will be rebuild on the fly.

Data for world seas were downloaded from:
https://catalog.data.gov/dataset/world-water-body-limits-detailed-2017mar30

## License

Copyright © 2021 Helmholtz Centre Potsdam - GFZ German Research Centre for Geosciences, Germany (https://www.gfz-potsdam.de)

This work is licensed under the following license(s):
* Software files are licensed under [Apache-2.0](LICENSES/Apache-2.0.txt)
* Everything else is licensed under [Apache-2.0](LICENSES/Apache-2.0.txt)

Please see the individual files for more accurate information.

> **Hint:** We provided the copyright and license information in accordance to the [REUSE Specification 3.0](https://reuse.software/spec/).
