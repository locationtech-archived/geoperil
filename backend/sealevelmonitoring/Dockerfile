FROM python:3.7-buster

ENV FEEDERSRV_URL http://localhost/feedersrv

WORKDIR /opt/slm

COPY requirements.txt .

RUN pip3 install -r requirements.txt

COPY slmloop.sh .
COPY slm.py .

CMD [ "/opt/slm/slmloop.sh" ]
