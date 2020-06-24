FROM tomcat:8.5.56-jdk8-openjdk

WORKDIR /opt/geoperil-api

RUN apt-get update && \
    apt-get install -y \
        maven

COPY server.xml /usr/local/tomcat/conf/server.xml
COPY src /opt/geoperil-api/src
COPY pom.xml /opt/geoperil-api/

RUN sed -i -e 's@localhost@mongo@' src/main/resources/config.properties && \
    mvn clean package && \
    cp /opt/geoperil-api/target/*.war /usr/local/tomcat/webapps/geoperil-api.war

EXPOSE 8080
