#!/bin/bash

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
