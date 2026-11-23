import 'server-only';
import { drizzle } from 'drizzle-orm/libsql';

import { environment } from '@/environment';

export const database = drizzle({
	connection: {
		url: environment.databaseUrl,
		authToken: environment.databaseAuthToken
	}
});
