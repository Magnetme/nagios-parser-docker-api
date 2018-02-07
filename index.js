const express = require('express');
const util = require('util');
const readFile = util.promisify(require('fs').readFile);
const nagiosParser = require('nagios-status-parser');

const app = express();

async function getNagiosData() {
	const nagiosData = await readFile('/opt/nagios/status.dat', 'utf8');
	return nagiosParser(nagiosData);
}

function mapState(input) {
	switch (input.toUpperCase()) {
		case 'CRITICAL':
			return 2;
		case 'WARNING':
			return 1;
		case 'OK':
			return 0;
		case 'UNKNOWN':
			return 3;
		default:
			throw new Error('Requested state not supported');
	}
}

function toBoolean(input) {
	switch (input.toLowerCase()) {
		case 'true':
		case '1':
			return 1;
		case 'false':
		case '0':
			return 0;
		default:
			throw new Error('Requested state not supported');
	}
}

const filters = {
	state : (input, val) => {

		const shouldNegate = val[0] === '!';
		const cleanValue = shouldNegate ? val.substring(1) : val;
		const desiredState = mapState(cleanValue);

		const comparator = e => {
			const currentState = e.current_state;
			if(shouldNegate) {
				return currentState !== desiredState;
			} else {
				return currentState === desiredState;
			}
		};

		return input.filter(comparator);
	},
	flapping : (input, val) => {
		const desiredState = toBoolean(val);
		return input.filter(e => e.is_flapping === desiredState);
	}
};

function filterByQuery(input, query) {
	if (!query) {
		return input;
	}

	return Object.keys(query).reduce((acc, key) => {
		const value = query[key];
		const applicableFilter = filters[key];
		if (!applicableFilter) {
			return acc;
		}
		return applicableFilter(acc, value);
	}, input)
}

app.get('/', async (req, res) => {
	res.json(await getNagiosData());
});

app.get('/info', async (req, res) => {
	const data = await getNagiosData();
	res.json(data.info[0]);
});
app.get('/program', async (req, res) => {
	const data = await getNagiosData();
	res.json(data.programstatus[0]);
});

app.get('/hosts/:host/services', async (req, res, next) => {
	const host = req.params.host;
	const data = await getNagiosData();
	res.json(filterByQuery(data.servicestatus.filter(e => e.host_name === host), req.query));
});
app.get('/hosts/:host', async (req, res, next) => {
	const host = req.params.host;
	const data = await getNagiosData();
	res.json(data.hoststatus.filter(e => e.host_name === host));
});
app.get('/hosts', async (req, res) => {
	const data = await getNagiosData();
	res.json(filterByQuery(filterByQuery(data.hoststatus), req.query));
});

app.get('/services/:service', async (req, res, next) => {
	const service = req.params.service;
	const data = await getNagiosData();
	res.json(filterByQuery(data.servicestatus.filter(e => e.service_description === service), req.query));
});
app.get('/services', async (req, res) => {
	const data = await getNagiosData();
	res.json(filterByQuery(data.servicestatus, req.query));
});

app.get('/contacts', async (req, res) => {
	const data = await getNagiosData();
	res.json(data.contactstatus);
});

app.listen(8080, () => {
	console.log('Service has started');
});

function shutdown() {
	console.log("Going down");
	process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('SIGHUP', shutdown);
