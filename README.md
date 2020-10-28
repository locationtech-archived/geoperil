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
