FROM ubuntu:18.04

# for not having interaction on installation process
ENV DEBIAN_FRONTEND noninteractive

RUN apt-get update && \
    apt-get install -y \
    python3.7 \
    python3-cherrypy3 \
    python3-pip \
    libapache2-mod-wsgi-py3 \
    apache2 \
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

RUN mkdir -p /tmp/geoperil/localdir && \
    mkdir /tmp/geoperil/results && \
    mkdir /tmp/geoperil/snapshots && \
    chown -R tomcat8 /tmp/geoperil && \
    mkdir -p /var/log/tomcat8 && \
    chown -R tomcat8 /var/log/tomcat8 && \
    mkdir -p /var/lib/tomcat8/.ssh && \
    chmod 0700 /var/lib/tomcat8/.ssh && \
    mkdir -p /opt/geoperil/simenv && \
    chown -R tomcat8 /opt/geoperil/simenv

COPY ./scripts/getShape.py /tmp/geoperil/localdir
COPY ./scripts/getFlood.py /tmp/geoperil/localdir
COPY ./scripts/getEWH.py /tmp/geoperil/localdir

COPY ./conf/ssh/id_rsa /var/lib/tomcat8/.ssh
COPY ./conf/ssh/id_rsa.pub /var/lib/tomcat8/.ssh
COPY ./conf/ssh/generate-known-hosts.sh /var/lib/tomcat8

WORKDIR /root/GeoHazardServices

RUN chown -Rv tomcat8:tomcat8 /var/lib/tomcat8/.ssh && \
    chmod 600 /var/lib/tomcat8/.ssh/id_rsa && \
    chmod 644 /var/lib/tomcat8/.ssh/id_rsa.pub && \
    sed -i -e 's@localhost@mongo@' src/main/resources/config.properties && \
    mvn clean package && \
    cp /root/GeoHazardServices/target/*.war /var/lib/tomcat8/webapps/geohazardservices.war

# workaround with "|| true" for bug https://github.com/moby/moby/issues/6800
# need sleep because of waiting for log files to be initially created
CMD service php7.2-fpm start && \
    service apache2 start && \
    service tomcat8 start || true && \
    sleep 3 && \
    /var/lib/tomcat8/generate-known-hosts.sh && \
    tail -f /var/log/apache2/error*.log /var/log/tomcat8/catalina.out \
        | grep --line-buffered -F -v "INFO:cherrypy.access"
EXPOSE 80
