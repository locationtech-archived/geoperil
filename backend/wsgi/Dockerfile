FROM python:3.7-buster

RUN mkdir /geoperil && \
    apt-get update && \
    apt-get install -y \
        apache2 \
        libapache2-mod-wsgi-py3 && \
    mkdir /geoperil && \
    chown www-data /geoperil

WORKDIR /srv/geoperil/wsgi

COPY requirements.txt .
RUN pip3 install -r requirements.txt

COPY apache.conf /etc/apache2/conf-enabled/geoperil-wsgi.conf
COPY config.cfg .
COPY *.py /srv/geoperil/wsgi/

EXPOSE 80

VOLUME [ "/geoperil" ]

CMD [ "/usr/sbin/apache2ctl", "-D", "FOREGROUND" ]
