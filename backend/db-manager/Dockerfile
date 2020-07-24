FROM python:3.7-buster

ENV MONGO_CONNECTION mongodb://mongo
ENV DATA_INSERT_URL http://localhost/srv/data_insert

WORKDIR /opt/db-manager

COPY requirements.txt .

RUN pip3 install -r requirements.txt

COPY World_water_body_limits_polygons.geojson.gz .
RUN gunzip World_water_body_limits_polygons.geojson.gz

COPY managerloop.sh .
COPY manager.py .

CMD [ "/opt/db-manager/managerloop.sh" ]
