import 'server-only';

function readRequiredVariable(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Environment variable ${name} is not set`);
	}
	return value;
}

export const environment = {
	databaseUrl: readRequiredVariable('DATABASE_URL'),
	databaseAuthToken: process.env['AUTH_TOKEN']
};
