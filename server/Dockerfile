FROM ubuntu:18.04

# for not having interaction on installation process
ENV DEBIAN_FRONTEND noninteractive

RUN apt-get update && \
    apt-get install -y \
    python3.7 \
    python3-cherrypy3 \
    python3-pip \
    libapache2-mod-wsgi-py3 apache2 \
    tomcat8 \
    maven \
    php7.2-fpm \
    php-mbstring \
    ssh \
    python3-dev \
    python3-setuptools \
    python3-wheel \
    python3-cffi \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 \
    libffi-dev \
    shared-mime-info

COPY requirements.txt requirements.txt

RUN pip3 install -r requirements.txt

VOLUME [ \
    "/var/www/geoperil/wsgi", \
    "/var/www/geoperil/htdocs", \
    "/opt/geoperil/worker", \
    "/opt/geoperil/GMT", \
    "/opt/geoperil/tools" \
]

COPY conf/apache2/sites-available/geoperil.conf /etc/apache2/sites-available/010-geoperil.conf

RUN a2enmod proxy && \
    a2enmod proxy_html && \
    a2enmod proxy_http && \
    a2enmod proxy_fcgi && \
    a2enconf php7.2-fpm && \
    a2ensite 010-geoperil

COPY ./tomcat/GeoHazardServices /root/GeoHazardServices
COPY ./tomcat/server.xml /etc/tomcat8/

# in this folder a KML file with the world sea regions is needed (as 'World_Seas.kml')
# http://www.marineregions.org/download_file.php?name=World_Seas_IHO_v1_kmz.zip
COPY ./db_manager /root/db_manager

RUN sed -i -e 's@trideccloud\.gfz-potsdam\.de@localhost@' /root/db_manager/manager.py && \
    sed -i -e 's@MongoReplicaSetClient@MongoClient@' /root/db_manager/manager.py && \
    sed -i -e 's@mongodb://tcnode1,tcnode2,tcnode3/?replicaSet=tcmongors0@mongodb://mongo@' /root/db_manager/manager.py && \
    mkdir -pv /tmp/geoperil/localdir && \
    mkdir -pv /tmp/geoperil/results && \
    chown -Rv tomcat8 /tmp/geoperil && \
    mkdir -pv /var/log/tomcat8 && \
    chown -Rv tomcat8 /var/log/tomcat8

WORKDIR /root/GeoHazardServices

RUN sed -i -e 's@localhost@mongo@' src/main/resources/config.properties && \
    mvn clean package && \
    cp /root/GeoHazardServices/target/*.war /var/lib/tomcat8/webapps/geohazardservices.war

# workaround with "true" for bug https://github.com/moby/moby/issues/6800
CMD service php7.2-fpm start && \
    service apache2 start && \
    service tomcat8 start || true && \
    tail -f /var/log/apache2/*geoperil.log /var/log/tomcat8/*
EXPOSE 80
