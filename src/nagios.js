const util = require('util');
const readFile = util.promisify(require('fs').readFile);
const nagiosParser = require('nagios-status-parser');

module.exports = async function getNagiosData() {
	const nagiosData = await readFile('/opt/nagios/status.dat', 'utf8');
	return nagiosParser(nagiosData);
}
