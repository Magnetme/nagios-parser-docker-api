function isNegated(input) {
	return input[0] === '!';
}

function cleanNegation(input) {
	return isNegated ? input.substring(1) : input;
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
	const cleanedValue = cleanNegation(input);
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

function areFiltersValid(query) {
	if (query.state && !isValidState(query.state)) {
		return false;
	}
	if (query.flapping && !isValidBoolean(query.state)) {
		return false;
	}

	return true;
}

module.exports = {
	mapState,
	toBoolean,
	areFiltersValid,
	cleanNegation,
	isNegated,
};
