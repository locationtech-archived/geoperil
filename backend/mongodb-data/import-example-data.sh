#!/bin/bash

set -e

for i in users settings institutions events eqs stations; do
    echo "Importing collection: $i"
    mongoimport --mode=upsert --host "$MONGO_HOST" --db "$MONGO_DB" --collection $i --type json --file /tmp/example-data/$i.json --jsonArray
done
