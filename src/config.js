const params = process.argv.splice(2)
	.filter(e => e)
	.map(e => e.toLowerCase());

let allowAllCors = false;
let withWebsockets = false;

if (params.includes('--allow-all-cors')) {
	allowAllCors = true;
}

if (params.includes('--with-ws')) {
	withWebsockets = true;
}

module.exports = {
	allowAllCors,
	withWebsockets
};
