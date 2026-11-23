import type { WikidataId } from '@/types';
import { runCatalogueQuery } from '@/wikidata/catalogue';
import type {
	CatalogueDateSource,
	CatalogueEntry
} from '@/wikidata/catalogue-types';
import {
	type DateSourceName,
	dateSourceNames,
	dateSourcesByName
} from '@/wikidata/date-sources';

/** Statement qualifier marking a date as approximate: sourcing circumstances = circa. */
const approximateDateQualifier = 'pq:P1480 wd:Q5727902';

const wikidataIdPattern = /^Q\d+$/;

/**
 * Properties relating an item to a topic: instance of, field of work, main subject, genre,
 * movement, facet of, and studied by.
 */
const topicRelationPath =
	'wdt:P31|wdt:P101|wdt:P921|wdt:P136|wdt:P135|wdt:P1269|wdt:P2579';

type CardQueryState = {
	itemPatterns: readonly string[];
	minimumSitelinks: number;
	dateSourceNames: readonly DateSourceName[];
	earliestYear: number | null;
	latestYear: number | null;
};

function assertWikidataId(id: string): string {
	if (!wikidataIdPattern.test(id)) {
		throw new RangeError(`Not a Wikidata item id: ${id}`);
	}
	return id;
}

/** @throws {RangeError} When the year is not a non-zero integer. */
function assertTimelineYear(year: number): number {
	if (!Number.isSafeInteger(year) || year === 0) {
		throw new RangeError(`Not a year: ${year}`);
	}
	return year;
}

/** Converts a year counted without year 0 to Wikidata's astronomical count, where 0 is 1 BCE. */
function toAstronomicalYear(year: number): number {
	return year < 0 ? year + 1 : year;
}

/** SPARQL date literal of the first moment of an astronomical year. */
function yearStartLiteral(astronomicalYear: number): string {
	const sign = astronomicalYear < 0 ? '-' : '';
	const digits = String(Math.abs(astronomicalYear)).padStart(4, '0');
	return `"${sign}${digits}-01-01T00:00:00Z"^^xsd:dateTime`;
}

/**
 * Builds the SPARQL pattern matching one date source. Every match binds `?statement`,
 * `?dateNode` and `?sourceIndex`; a date on another statement also binds `?statementValue`
 * and, when it has an English label, `?statementValueLabel`.
 */
function buildDateSourcePattern(
	dateSource: CatalogueDateSource,
	sourceIndex: number
): string {
	if (dateSource.type === 'item') {
		return `{
		?item p:${dateSource.property} ?statement .
		?statement a wikibase:BestRank ; psv:${dateSource.property} ?dateNode .
		BIND(${sourceIndex} AS ?sourceIndex)
	}`;
	}
	return `{
		?item p:${dateSource.statementProperty} ?statement .
		?statement a wikibase:BestRank ;
			ps:${dateSource.statementProperty} ?statementValue ;
			pqv:${dateSource.qualifierProperty} ?dateNode .
		OPTIONAL { ?statementValue rdfs:label ?statementValueLabel . FILTER(LANG(?statementValueLabel) = "en") }
		BIND(${sourceIndex} AS ?sourceIndex)
	}`;
}

/**
 * Immutable builder of a query for dated Wikidata facts. Every method returns a new query
 * narrowed further; filters add up, so repeating one only narrows more.
 * Only best-ranked statements are matched, and only items with an English label.
 * Item filters are evaluated in the order they were added, before the dates.
 *
 * @example
 * const entries = await CardQuery.builder().inAnyTopic(['Q362', 'Q178561']).minimumSitelinks(60).dateSources('point-in-time').execute();
 */
export class CardQuery {
	private constructor(private readonly state: CardQueryState) {}

	/** Starts a query matching every item with any in-scope date. */
	static builder(): CardQuery {
		return new CardQuery({
			itemPatterns: [],
			minimumSitelinks: 0,
			dateSourceNames: [],
			earliestYear: null,
			latestYear: null
		});
	}

	/**
	 * Keeps items in at least one of the given topics. An item is in a topic when, for every id
	 * of the topic, it is part of that item, directly or through intermediate parts, or relates to
	 * it or to any of its subclasses as `topicRelationPath` lists.
	 * The first id of a topic finds the items, so it should be the narrowest; later ids only check them.
	 * @throws {RangeError} When no topic is given, a topic has no id, or an id is not a Wikidata item id.
	 */
	inAnyTopic(...topics: readonly (readonly WikidataId[])[]): CardQuery {
		if (topics.length === 0 || topics.some(topic => topic.length === 0)) {
			throw new RangeError(
				'Expected at least one topic, each with at least one id'
			);
		}
		const patternIndex = this.state.itemPatterns.length;
		const topicBranches = topics.map((topic, topicIndex) =>
			topic
				.map((id, idIndex) => {
					const entity = `wd:${assertWikidataId(id)}`;
					if (idIndex > 0) {
						return `{ ?item wdt:P361+ ${entity} . } UNION { ?item (${topicRelationPath})/wdt:P279* ${entity} . }`;
					}
					const classVariable = `?topicClass${patternIndex}_${topicIndex}`;
					return `{ ?item wdt:P361+ ${entity} . } UNION { ${classVariable} wdt:P279* ${entity} . ?item ${topicRelationPath} ${classVariable} . }`;
				})
				.join(' ')
		);
		return this.withItemPattern(
			topicBranches.map(branch => `{ ${branch} }`).join(' UNION ')
		);
	}

	/**
	 * Keeps items located in at least one of the given places: their country, location or
	 * administrative area is the place, or has it as its country or continent.
	 * @throws {RangeError} When no id is given or an id is not a Wikidata item id.
	 */
	locatedIn(...ids: readonly WikidataId[]): CardQuery {
		if (ids.length === 0) {
			throw new RangeError('Expected at least one place');
		}
		const suffix = this.state.itemPatterns.length;
		const place = `?locationPlace${suffix}`;
		const area = `?locationArea${suffix}`;
		const country = `?locationCountry${suffix}`;
		const places = ids.map(id => `wd:${assertWikidataId(id)}`).join(', ');
		return this.withItemPattern(
			`?item wdt:P17|wdt:P276|wdt:P131 ${place} . { BIND(${place} AS ${area}) } UNION { ${place} wdt:P17|wdt:P30 ${area} } UNION { ${place} wdt:P17 ${country} . ${country} wdt:P30 ${area} } FILTER(${area} IN (${places}))`
		);
	}

	/** Keeps items that have an image. */
	withImage(): CardQuery {
		return this.withItemPattern('FILTER EXISTS { ?item wdt:P18 [] }');
	}

	/** Keeps items that have no image. */
	withoutImage(): CardQuery {
		return this.withItemPattern('FILTER NOT EXISTS { ?item wdt:P18 [] }');
	}

	/**
	 * Keeps dates in or after the given year; a negative year is BCE.
	 * @throws {RangeError} When the year is not a non-zero integer.
	 */
	fromYear(year: number): CardQuery {
		assertTimelineYear(year);
		const { earliestYear } = this.state;
		return new CardQuery({
			...this.state,
			earliestYear: earliestYear === null ? year : Math.max(earliestYear, year)
		});
	}

	/**
	 * Keeps dates in or before the given year; a negative year is BCE.
	 * @throws {RangeError} When the year is not a non-zero integer.
	 */
	toYear(year: number): CardQuery {
		assertTimelineYear(year);
		const { latestYear } = this.state;
		return new CardQuery({
			...this.state,
			latestYear: latestYear === null ? year : Math.min(latestYear, year)
		});
	}

	/**
	 * Keeps items linked from at least the given number of Wikimedia sites.
	 * @throws {RangeError} When the count is not a non-negative integer.
	 */
	minimumSitelinks(count: number): CardQuery {
		if (!Number.isSafeInteger(count) || count < 0) {
			throw new RangeError(`Not a non-negative integer: ${count}`);
		}
		return new CardQuery({
			...this.state,
			minimumSitelinks: Math.max(this.state.minimumSitelinks, count)
		});
	}

	/**
	 * Adds kinds of date to match; without any, every in-scope kind is matched.
	 * @throws {RangeError} When a name is not a known date source.
	 */
	dateSources(...names: DateSourceName[]): CardQuery {
		const unknownName = names.find(
			name => !Object.hasOwn(dateSourcesByName, name)
		);
		if (unknownName !== undefined) {
			throw new RangeError(`Not a date source: ${unknownName}`);
		}
		return new CardQuery({
			...this.state,
			dateSourceNames: [...new Set([...this.state.dateSourceNames, ...names])]
		});
	}

	/**
	 * Runs the query on Wikidata, or answers from the cache when the same query ran before.
	 * @returns One entry per dated fact.
	 */
	execute(): Promise<CatalogueEntry[]> {
		const selectedNames =
			this.state.dateSourceNames.length > 0
				? this.state.dateSourceNames
				: dateSourceNames;
		return runCatalogueQuery(this.toSparql(selectedNames), selectedNames);
	}

	private withItemPattern(pattern: string): CardQuery {
		return new CardQuery({
			...this.state,
			itemPatterns: [...this.state.itemPatterns, pattern]
		});
	}

	/** SPARQL text whose `?sourceIndex` in each row indexes the given names. */
	private toSparql(selectedNames: readonly DateSourceName[]): string {
		const itemFilters = [
			...this.state.itemPatterns,
			'?item wikibase:sitelinks ?sitelinks .',
			...(this.state.minimumSitelinks > 0
				? [`FILTER(?sitelinks >= ${this.state.minimumSitelinks})`]
				: [])
		];
		const dateSourcePatterns = selectedNames.map((name, index) =>
			buildDateSourcePattern(dateSourcesByName[name], index)
		);
		const { earliestYear, latestYear } = this.state;
		const dateFilters = [
			...(earliestYear === null
				? []
				: [
						`FILTER(?date >= ${yearStartLiteral(toAstronomicalYear(earliestYear))})`
					]),
			...(latestYear === null
				? []
				: [
						`FILTER(?date < ${yearStartLiteral(toAstronomicalYear(latestYear) + 1)})`
					])
		];

		return `SELECT ?item ?sourceIndex ?statementValue ?statementValueLabel ?date ?precision ?approximate ?label ?description ?image ?sitelinks WHERE {
	hint:Query hint:optimizer "None" .
	${itemFilters.join('\n\t')}
	${dateSourcePatterns.join('\n\tUNION\n\t')}
	?dateNode wikibase:timeValue ?date ; wikibase:timePrecision ?precision .
	${dateFilters.join('\n\t')}
	OPTIONAL { ?statement ${approximateDateQualifier} . BIND(true AS ?approximate) }
	?item rdfs:label ?label . FILTER(LANG(?label) = "en")
	OPTIONAL { ?item schema:description ?description . FILTER(LANG(?description) = "en") }
	OPTIONAL { ?item wdt:P18 ?image }
}`;
	}
}
