#!/bin/bash

set -e

cmd="$@"

until mongo --eval "db.getCollectionNames()" "$MONGO_HOST/$MONGO_DB"; do
  >&2 echo "Mongodb is unavailable - sleeping"
  sleep 1
done

>&2 echo "Mongodb is up - executing command"
exec $cmd
