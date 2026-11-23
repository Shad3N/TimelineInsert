import 'server-only';
import { z } from 'zod';

import { wikimediaUserAgent } from '@/const';

const queryServiceUrl = 'https://query.wikidata.org/sparql';

const queryTimeoutMilliseconds = 65_000;

const sparqlValueSchema = z.object({
	'type': z.enum(['uri', 'literal', 'bnode']),
	'value': z.string(),
	'datatype': z.string().optional(),
	'xml:lang': z.string().optional()
});

const sparqlRowSchema = z.record(z.string(), sparqlValueSchema);

const sparqlResponseSchema = z.object({
	results: z.object({ bindings: z.array(sparqlRowSchema) })
});

export type SparqlRow = z.infer<typeof sparqlRowSchema>;

/**
 * Runs a SPARQL query against the Wikidata Query Service.
 *
 * @param query SPARQL query text.
 * @returns The result rows, each mapping a selected variable to its value.
 * @throws {Error} When the service answers with a non-success status.
 * @throws {z.ZodError} When the response does not follow the SPARQL JSON results format.
 */
export async function runSparqlQuery(query: string): Promise<SparqlRow[]> {
	const url = new URL(queryServiceUrl);
	url.searchParams.set('query', query);
	const response = await fetch(url, {
		headers: {
			'Accept': 'application/sparql-results+json',
			'User-Agent': wikimediaUserAgent
		},
		signal: AbortSignal.timeout(queryTimeoutMilliseconds)
	});
	if (!response.ok) {
		throw new Error(`Wikidata query failed with status ${response.status}`);
	}
	return sparqlResponseSchema.parse(await response.json()).results.bindings;
}
