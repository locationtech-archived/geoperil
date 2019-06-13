FROM ubuntu:18.04

# for not having interaction on installation process
ENV DEBIAN_FRONTEND noninteractive

RUN apt-get update && apt-get install python3.7 python3-cherrypy3 python3-pip libapache2-mod-wsgi-py3 apache2 tomcat8 maven -y

COPY requirements.txt requirements.txt

RUN pip3 install -r requirements.txt

VOLUME ["/var/www/geoperil/wsgi", "/var/www/geoperil/htdocs"]

COPY conf/apache2/sites-available/geoperil.conf /etc/apache2/sites-available/010-geoperil.conf

RUN a2enmod proxy
RUN a2enmod proxy_html
RUN a2enmod proxy_http

RUN a2ensite 010-geoperil

COPY ./tomcat/GeoHazardServices /tmp/GeoHazardServices
COPY ./tomcat/server.xml /etc/tomcat8/

WORKDIR /tmp/GeoHazardServices

RUN sed -i -e 's@localhost@mongo@' src/main/resources/config.properties
RUN mvn clean package
RUN cp /tmp/GeoHazardServices/target/*.war /var/lib/tomcat8/webapps/geohazardservices.war

# workaround with "true" for bug https://github.com/moby/moby/issues/6800
CMD service apache2 start && service tomcat8 start || true && tail -f /var/log/apache2/*geoperil.log /var/log/tomcat8/*
EXPOSE 80
