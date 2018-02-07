# nagios-parser-docker-api

In order to read the status of our nagios servers, we use the following service, which runs within docker.

You can start it as follows `docker run -v /var/cache/nagios3/:/opt/nagios -p 8080:8080 magnetme/nagios-parser-docker-api:latest`.
In this case you can just execute `http://localhost:8080` to see all of nagios' data in JSON format.
