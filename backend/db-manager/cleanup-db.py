#!/usr/bin/env python3

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

import os
import time
from datetime import datetime, timedelta
from pymongo import MongoClient


def main():
    mongo_connection = os.environ["MONGO_CONNECTION"]
    years_in_days = 3 * 365
    remove_older_than = datetime.today() - timedelta(days=years_in_days)

    print(
        "Removing sealevel data older than "
        + str(remove_older_than.timestamp())
        + " = " + remove_older_than.isoformat()
    )

    start_time = time.time()

    cnt_removed = 0

    client = MongoClient(
        mongo_connection, socketTimeoutMS=10000, connectTimeoutMS=10000
    )
    dbm = client["geoperil"]
    sealeveldata = dbm["sealeveldata"]

    queryfilter = {
        "timestamp": {"$lt": remove_older_than.timestamp()}
    }
    querysort = [("timestamp", 1)]

    data = sealeveldata.find(queryfilter).sort(querysort).limit(10**8)

    for item in data:
        sealeveldata.delete_one({"_id": item.get("_id")})
        cnt_removed += 1

    client.close()

    print("Removed: %u" % cnt_removed)

    end_time = time.time()

    print("Duration: %u sec." % (end_time - start_time))


if __name__ == "__main__":
    main()
