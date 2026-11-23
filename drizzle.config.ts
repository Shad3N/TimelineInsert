import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	dialect: 'turso',
	schema: './src/database/schema/*',
	out: './.drizzle',
	dbCredentials: {
		url: process.env['DATABASE_URL']!,
		authToken: process.env['AUTH_TOKEN']
	}
});
