const express = require('express');
const util = require('util');
const readFile = util.promisify(require('fs').readFile);
const nagiosParser = require('nagios-status-parser');

const app = express();

app.get('/', async (req, res) => {
	try {
		const nagiosData = await readFile('/opt/nagios/status.dat', 'utf8');
		const parsed = nagiosParser(nagiosData);
		res.json(parsed);
	} catch (e) {
		res.status(500).end(e);
		console.error(e);
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
