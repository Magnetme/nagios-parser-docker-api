const express = require('express');
const util = require('util');
const readFile = util.promisify(require('fs').readFile);
const nagiosParser = require('nagios-status-parser');
const cors = require('cors');

const app = express();
if (process.argv[2] && process.argv[2] === '--allow-all-cors') {
	console.log('Allowing CORS from all origins');
	app.use(cors());
}

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

function isValidState(input) {
	const isNegated = input[0] === '!';
	const cleanedValue = isNegated ? input.substring(1) : input;
	try {
		mapState(cleanedValue);
		return true;
	} catch (e) {
		return false;
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

function isValidBoolean(input) {
	try {
		toBoolean(input);
		return true;
	} catch (e) {
		return false;
	}
}

const filters = {
	state : (input, val) => {

		const shouldNegate = val[0] === '!';
		const cleanValue = shouldNegate ? val.substring(1) : val;
		const desiredState = mapState(cleanValue);

		const comparator = e => {
			const currentState = e.current_state;
			if (shouldNegate) {
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

function areFiltersValid(query) {
	if (query.state && !isValidState(query.state)) {
		return false;
	}
	if (query.flapping && !isValidBoolean(query.state)) {
		return false;
	}

	return true;
}

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

const UNSUPPORTED_FILTER = {error : 'Unsupported filter requested'};
const NAGIOS_UNAVAILABLE = {error : 'Nagios unavailable'};

app.get('/', async (req, res) => {
	try {
		res.json(await getNagiosData());
	} catch (e) {
		res.status(500).json(NAGIOS_UNAVAILABLE);
	}
});

app.get('/info', async (req, res) => {
	try {
		const data = await getNagiosData();
		res.json(data.info[0]);
	} catch (e) {
		res.status(500).json(NAGIOS_UNAVAILABLE);
	}
});
app.get('/program', async (req, res) => {
	try {
		const data = await getNagiosData();
		res.json(data.programstatus[0]);
	} catch (e) {
		res.status(500).json(NAGIOS_UNAVAILABLE);
	}
});

app.get('/hosts/:host/services', async (req, res) => {
	if (!areFiltersValid(req.query)) {
		res.status(400).json(UNSUPPORTED_FILTER);
		return;
	}

	try {
		const host = req.params.host;
		const data = await getNagiosData();
		res.json(filterByQuery(data.servicestatus.filter(e => e.host_name === host), req.query));
	} catch (e) {
		res.status(500).json(NAGIOS_UNAVAILABLE);
	}
});
app.get('/hosts/:host', async (req, res) => {
	try {
		const host = req.params.host;
		const data = await getNagiosData();
		res.json(data.hoststatus.filter(e => e.host_name === host));
	} catch (e) {
		res.status(500).json(NAGIOS_UNAVAILABLE);
	}
});
app.get('/hosts', async (req, res) => {
	if (!areFiltersValid(req.query)) {
		res.status(400).json(UNSUPPORTED_FILTER);
		return;
	}

	try {
		const data = await getNagiosData();
		res.json(filterByQuery(filterByQuery(data.hoststatus), req.query));
	} catch (e) {
		res.status(500).json(NAGIOS_UNAVAILABLE);
	}
});

app.get('/services/:service', async (req, res) => {
	if (!areFiltersValid(req.query)) {
		res.status(400).json(UNSUPPORTED_FILTER);
		return;
	}

	try {
		const service = req.params.service;
		const data = await getNagiosData();
		res.json(filterByQuery(data.servicestatus.filter(e => e.service_description === service), req.query));
	} catch (e) {
		res.status(500).json(NAGIOS_UNAVAILABLE);
	}
});
app.get('/services', async (req, res) => {
	try {
		if (!areFiltersValid(req.query)) {
			res.status(400).json(UNSUPPORTED_FILTER);
			return;
		}

		const data = await getNagiosData();
		res.json(filterByQuery(data.servicestatus, req.query));
	} catch (e) {
		res.status(500).json(NAGIOS_UNAVAILABLE);
	}
});

app.get('/contacts', async (req, res) => {
	try {
		const data = await getNagiosData();
		res.json(data.contactstatus);
	} catch (e) {
		res.status(500).json(NAGIOS_UNAVAILABLE);
	}
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
