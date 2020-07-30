# EasyWave CPU worker for GeoPeril

## Development setup

To start a local development environment run:

```shell
docker-compose -f docker-compose-dev.yml up --build
# WPS server should be available at http://localhost:5000/wps
```

## TODO

- add cron job for removing old XML files from /srv/wps/outputs/
