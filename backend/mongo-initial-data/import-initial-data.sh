#!/bin/bash

# GeoPeril - A platform for the computation and web-mapping of hazard specific
# geospatial data, as well as for serving functionality to handle, share, and
# communicate threat specific information in a collaborative environment.
#
# Copyright (C) 2021 GFZ German Research Centre for Geosciences
#
# SPDX-License-Identifier: Apache-2.0
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
#   Johannes Spazier (GFZ)
#   Sven Reissland (GFZ)
#   Martin Hammitzsch (GFZ)
#   Matthias Rüster (GFZ)
#   Hannes Fuchs (GFZ)

# using mode 'insert' so that the initial data are only inserted once
# subsequent calls should not overwrite the modified fields (e.g. password)

for i in users settings institutions; do
    echo "Importing collection: $i"
    mongoimport \
        --mode=insert \
        --host "$MONGO_HOST" \
        --db "$MONGO_DB" \
        --collection $i \
        --type json \
        --file /tmp/initial-data/$i.json \
        --jsonArray || true
done

mongo --eval "db.sealeveldata.createIndex({'timestamp': 1})" "$MONGO_HOST/$MONGO_DB"
mongo --eval "db.sealeveldata.createIndex({'inst': 1})" "$MONGO_HOST/$MONGO_DB"
mongo --eval "db.sealeveldata.createIndex({'station': 1})" "$MONGO_HOST/$MONGO_DB"
mongo --eval "db.simsealeveldata.createIndex({'timestamp': 1})" "$MONGO_HOST/$MONGO_DB"
mongo --eval "db.eqs.createIndex({'prop.date': 1})" "$MONGO_HOST/$MONGO_DB"
mongo --eval "db.eqs.createIndex({'timestamp': 1})" "$MONGO_HOST/$MONGO_DB"
mongo --eval "db.pickings.createIndex({'userid': 1, 'evtid': 1, 'station': 1})" "$MONGO_HOST/$MONGO_DB"
