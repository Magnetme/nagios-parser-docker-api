const expressWs = require('express-ws');
const getNagiosData = require('./nagios');

let interval = null;
let mostRecentClientId = 0;

let clients = [];

const hostStatusMap = [];
const serviceStatusMap = [];

async function poll() {
	const data = await getNagiosData();
	const hosts = data.hoststatus;
	const services = data.servicestatus;

	let requireHostPush = false;
	let requireServicePush = false;

	hosts.forEach(host => {
		const name = host.host_name;
		const status = host.current_state;
		const type = host.state_type;
		if (hostStatusMap[name] && hostStatusMap[name].status === status && hostStatusMap[name].type === type) {
			// all OK here, no changes
		}
		else {
			requireHostPush = true;
		}
		hostStatusMap[name] = {name, status, type};
	});

	services.forEach(service => {
		const name = `${service.host_name}----${service.service_description}`;
		const status = service.current_state;
		const type = service.state_type;
		if (serviceStatusMap[name] && serviceStatusMap[name].status === status && serviceStatusMap[name].type === type) {
			// all OK here, no changes
		}
		else {
			requireServicePush = true;
		}
		serviceStatusMap[name] = {name, status, type};
	});

	if (requireHostPush) {
		console.log('State change found for hosts');
		clients.forEach(client => client.send('update-hosts'));
	}
	if (requireServicePush) {
		console.log('State change found for services');
		clients.forEach(client => client.send('update-services'));
	}
}

function startPolling() {
	interval = setInterval(poll, 5000);
	console.log('First websocket client connected, starting polling');
	poll();
}

function stopPolling() {
	clearInterval(interval);
	interval = null;
	console.log('Last websocket client disconnected, stopping polling');
}

module.exports = function init(app) {
	console.log('Starting websockets');
	expressWs(app);

	app.ws('/', function (ws) {
		const clientId = ++mostRecentClientId;

		ws.onclose = () => {
			console.log(`Client ${clientId} disconnected`);
			// Deregister client
			clients = clients.filter(e => e.clientId !== clientId);

			// Stop pollling if no longer required
			if (clients.length === 0) {
				stopPolling();
			}
		};

		console.log(`Client ${clientId} connected`);
		clients = [...clients, {
			clientId,
			send : (message) => {
				if (ws.readyState !== ws.OPEN) {
					console.log(`Client ${clientId} was not ready for messages, omitting '${message}'`);
					return;
				}
				ws.send(message);
			},
			close : () => {
				if (ws.readyState !== ws.OPEN) {
					ws.close();
				}
			}
		}];
		if (interval === null) {
			startPolling();
		}
	});

	function shutdown() {
		clients.forEach(client => client.close());
	}

	process.on('SIGINT', shutdown);
	process.on('SIGTERM', shutdown);
	process.on('SIGHUP', shutdown);
};

