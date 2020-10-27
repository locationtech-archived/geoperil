FROM node:10.21-buster

WORKDIR /opt/geoperil-frontend

RUN apt-get update && \
    apt-get install -y yarn

COPY . .

RUN yarn install

EXPOSE 3000

CMD [ "/bin/bash", "/opt/geoperil-frontend/start.sh" ]
