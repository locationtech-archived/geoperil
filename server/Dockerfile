FROM ubuntu:18.04

# for not having interaction on installation process
ENV DEBIAN_FRONTEND noninteractive

RUN apt-get update && apt-get install python3.7 python3-cherrypy3 python3-pip libapache2-mod-wsgi-py3 apache2 -y

COPY requirements.txt requirements.txt

RUN pip3 install -r requirements.txt

COPY wsgi /var/www/geoperil/wsgi
COPY www /var/www/geoperil/htdocs
COPY conf/apache2/sites-available/geoperil.conf /etc/apache2/sites-available/010-geoperil.conf

RUN a2ensite 010-geoperil

CMD service apache2 start && tail -f /var/log/apache2/*geoperil.log
EXPOSE 80
