FROM python:3.7-buster

RUN apt-get update && \
    apt-get install -y \
        apache2 \
        libapache2-mod-wsgi-py3

WORKDIR /srv/geoperil/wsgi

COPY requirements.txt .
RUN pip3 install -r requirements.txt

COPY apache.conf /etc/apache2/conf-enabled/geoperil-wsgi.conf
COPY config.cfg .
COPY *.py /srv/geoperil/wsgi/

EXPOSE 80

CMD [ "/usr/sbin/apache2ctl", "-D", "FOREGROUND" ]
