const express = require('express');
const cors = require('cors');

const getNagiosData = require('./nagios');
const {mapState, toBoolean, areFiltersValid, cleanNegation, isNegated} = require('./transformers');
const config = require('./config');

const app = express();

console.log('Starting with options', config);

if (config.allowAllCors) {
	app.use(cors());
}
if (config.withWebsockets) {
	require('./ws.js')(app);
}

const filters = {
	state : (input, val) => {
		const shouldNegate = isNegated(val);
		const desiredState = mapState(cleanNegation(val));

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
const HOST_NOT_FOUND = {error : 'Requested host was not found'};
const SERVICE_NOT_FOUND = {error : 'Requested service was not found'};
const NON_UNIQUE_MATCH = {error : 'Requested service appeared on multiple hosts'};

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

app.get('/hosts/:host/services/:service', async (req, res) => {
	if (!areFiltersValid(req.query)) {
		res.status(400).json(UNSUPPORTED_FILTER);
		return;
	}

	const host = req.params.host;
	const service = req.params.service;
	let data;
	try {
		data = await getNagiosData();
	} catch (e) {
		res.status(500).json(NAGIOS_UNAVAILABLE);
		return;
	}

	const filteredForHost = data.servicestatus.filter(e => e.host_name === host);
	if (filteredForHost.length === 0) {
		res.status(404).json(HOST_NOT_FOUND);
		return;
	}
	const result = filterByQuery(filteredForHost.filter(e => e.service_description === service), req.query);
	if (result.length === 0) {
		res.status(404).json(SERVICE_NOT_FOUND);
		return;
	}
	res.json(result);
});

app.get('/hosts/:host/services', async (req, res) => {
	if (!areFiltersValid(req.query)) {
		res.status(400).json(UNSUPPORTED_FILTER);
		return;
	}

	let data;
	try {
		const host = req.params.host;
		data = await getNagiosData();
	} catch (e) {
		res.status(500).json(NAGIOS_UNAVAILABLE);
		return;
	}

	const result = filterByQuery(data.servicestatus.filter(e => e.host_name === host), req.query);
	if (result.length === 0) {
		res.status(404).end(HOST_NOT_FOUND);
		return;
	}
	res.json(result);
});

app.get('/hosts/:host', async (req, res) => {
	const host = req.params.host;
	let data;
	try {
		data = await getNagiosData();
	} catch (e) {
		result.status(500).json(NAGIOS_UNAVAILABLE);
	}

	const result = data.hoststatus.filter(e => e.host_name === host);

	if (result.length === 0) {
		res.status(404).json(HOST_NOT_FOUND);
		return;
	}

	res.json(result[0]);
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

	const service = req.params.service;
	let data;
	try {
		data = await getNagiosData();
	} catch (e) {
		res.status(500).json(NAGIOS_UNAVAILABLE);
		return;
	}

	const result = filterByQuery(data.servicestatus.filter(e => e.service_description === service), req.query);
	if (result.length === 0) {
		res.status(404).json(SERVICE_NOT_FOUND);
		return;
	}
	else if (result.length > 1) {
		const matches = result.map(({host_name, service_description}) => ({
			host : host_name,
			service : service_description
		}));
		res.status(412).json({...NON_UNIQUE_MATCH, matches});
		return;
	}

	res.json(result[0]);

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
