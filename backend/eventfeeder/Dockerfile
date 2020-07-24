FROM python:3.7-buster

ENV FEEDERSRV_URL http://geoperil-wsgi/feedersrv/feedhazardevent

WORKDIR /opt/eventfeeder

COPY requirements.txt .

RUN pip3 install -r requirements.txt

COPY eventfeeder.py .
COPY feederloop.sh .

CMD [ "/opt/eventfeeder/feederloop.sh" ]
