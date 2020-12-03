const util = require('util');
const {mapState} = require("./transformers");
const writeFile = util.promisify(require('fs').writeFile);

function stripDelimiters(input) {
	return new String(input).replace(/;/g, ',',);
}

module.exports = async function writeToNagiosCommands(host, service, state, output) {
	const now = Math.floor(new Date() / 1000);
	const command = `[${now}] PROCESS_SERVICE_CHECK_RESULT;${stripDelimiters(host)};${stripDelimiters(service)};${mapState(state)};${stripDelimiters(output)}`;
	await writeFile('/opt/commands/nagios.cmd', command, {flag : 'a'});
}
