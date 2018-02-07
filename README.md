# nagios-parser-docker-api

In order to read the status of our nagios servers, we use the following service, which runs within docker.
It exposes the status of nagios through HTTP in a sensible way

## Endpoints

| Endpoint | Filters | Description |
|---|---|---|
| `/` | No | Returns the entire overview of Nagios |
| `/info` | No | Returns the information about Nagios |
| `/program` | No | Returns the informatino about running Nagios program and settings |
| `/hosts/:host/services` | Yes | Returns service information about services on the specified host |
| `/hosts/:host` | No | Returns host information on the specified host |
| `/hosts` | Yes | Returns host information on all hosts |
| `/services/:service` | Yes | Returns service information about services with the specified service name |
| `/services` | Yes | Returns service information on all services |
| `/contacts` | No | Returns all contact information |

## Filters

| Filter | Values | Description |
|---|---|---|
| `state` | `OK`, `WARNING`, `CRITICAL`, `UNKNOWN` | Only show services or hosts which match the speficied state. Prepend with `!` for a negation. So `!OK` will return all non-OK services or hosts |
| `flaping` | `true`, `false`, `1`, `0` | Only show services or hosts which are currently flapping (or not) |

## Running it

[![Docker Automated build](https://img.shields.io/docker/automated/magnetme/nagios-parser-docker-api.svg)]()
[![npm](https://img.shields.io/npm/v/nagios-parser-docker.svg)]()

You can start it as follows `docker run -v /var/cache/nagios3/:/opt/nagios -p 8080:8080 magnetme/nagios-parser-docker-api:latest`.
In this case you can just execute `http://localhost:8080` to see all of nagios' data in JSON format.
