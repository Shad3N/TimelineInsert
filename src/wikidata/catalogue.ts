import 'server-only';
import { cacheLife } from 'next/cache';

import type {
	CardDateSource,
	DatePrecision,
	TimelineDate,
	WikidataId
} from '@/types';
import { buildCardTitle } from '@/wikidata/card-title-templates';
import type {
	CatalogueDateSource,
	CatalogueEntry
} from '@/wikidata/catalogue-types';
import {
	type DateSourceName,
	dateSourcesByName
} from '@/wikidata/date-sources';
import { runSparqlQuery, type SparqlRow } from '@/wikidata/query-service';

/** Date precisions indexed by Wikidata's precision number. */
const datePrecisionByWikidataNumber: readonly DatePrecision[] = [
	'billion-years',
	'hundred-million-years',
	'ten-million-years',
	'million-years',
	'hundred-thousand-years',
	'ten-thousand-years',
	'millennium',
	'century',
	'decade',
	'year',
	'month',
	'day'
];

const entityIdPattern = /\/(Q\d+)$/;

const timeValuePattern = /^(-?\d+)-(\d{2})-(\d{2})T/;

function parseEntityId(uri: string | undefined): WikidataId | null {
	const match = uri?.match(entityIdPattern);
	return match ? (match[1] as WikidataId) : null;
}

/**
 * Converts a Wikidata time value to a timeline date.
 * Wikidata counts years astronomically, with year 0 as 1 BCE; the result has no year 0.
 */
function parseTimelineDate(
	timeValue: string,
	precisionNumber: number,
	approximate: boolean
): TimelineDate | null {
	const match = timeValue.match(timeValuePattern);
	const precision = datePrecisionByWikidataNumber[precisionNumber];
	if (!match || !precision) {
		return null;
	}
	const astronomicalYear = Number(match[1]);
	const year = astronomicalYear <= 0 ? astronomicalYear - 1 : astronomicalYear;
	const hasMonth = precision === 'month' || precision === 'day';
	return {
		year,
		...(hasMonth && { month: Number(match[2]) }),
		...(precision === 'day' && { day: Number(match[3]) }),
		precision,
		approximate
	};
}

/** Image file name on Wikimedia Commons, taken from the file path URI Wikidata returns. */
function parseImageFileName(uri: string | undefined): string | null {
	return uri ? decodeURIComponent(uri.slice(uri.lastIndexOf('/') + 1)) : null;
}

function parseEntry(
	row: SparqlRow,
	dateSourceNames: readonly DateSourceName[]
): CatalogueEntry | null {
	const item = parseEntityId(row['item']?.value);
	const dateSourceName = dateSourceNames[Number(row['sourceIndex']?.value)];
	const label = row['label']?.value;
	const timeValue = row['date']?.value;
	const sitelinks = Number(row['sitelinks']?.value);
	if (!item || !dateSourceName || !label || !timeValue) {
		return null;
	}
	const dateSource: CatalogueDateSource = dateSourcesByName[dateSourceName];
	const date = parseTimelineDate(
		timeValue,
		Number(row['precision']?.value),
		row['approximate']?.value === 'true'
	);
	if (!date) {
		return null;
	}
	let cardDateSource: CardDateSource;
	let statementValueLabel: string | null = null;
	if (dateSource.type === 'item') {
		cardDateSource = dateSource;
	} else {
		const statementValue = parseEntityId(row['statementValue']?.value);
		if (!statementValue) {
			return null;
		}
		cardDateSource = { ...dateSource, statementValue };
		statementValueLabel = row['statementValueLabel']?.value ?? statementValue;
	}
	return {
		item,
		dateSource: cardDateSource,
		label,
		title: buildCardTitle(dateSourceName, label, statementValueLabel),
		description: row['description']?.value ?? null,
		date,
		imageFileName: parseImageFileName(row['image']?.value),
		sitelinks
	};
}

/** Identifies the card an entry would become: its item plus where its date sits. */
function entryCardKey(entry: CatalogueEntry): string {
	return JSON.stringify([entry.item, entry.dateSource]);
}

function entryDateKey(entry: CatalogueEntry): string {
	return JSON.stringify(entry.date);
}

function findItemDateEntry(
	itemEntries: readonly CatalogueEntry[],
	dateSourceName: 'point-in-time' | 'start' | 'end'
): CatalogueEntry | undefined {
	const { property } = dateSourcesByName[dateSourceName];
	return itemEntries.find(
		entry =>
			entry.dateSource.type === 'item' && entry.dateSource.property === property
	);
}

/**
 * Removes overlapping event dates of one item. When the start and end differ, the item spans
 * a range, so its point in time is left out; when the point in time, start and end are one
 * date, only the point in time is kept.
 */
function reconcileEventDates(
	entries: readonly CatalogueEntry[]
): CatalogueEntry[] {
	const removedEntries = new Set<CatalogueEntry>();
	for (const itemEntries of Map.groupBy(
		entries,
		entry => entry.item
	).values()) {
		const pointInTime = findItemDateEntry(itemEntries, 'point-in-time');
		const start = findItemDateEntry(itemEntries, 'start');
		const end = findItemDateEntry(itemEntries, 'end');
		if (!start || !end) {
			continue;
		}
		const startDateKey = entryDateKey(start);
		if (startDateKey !== entryDateKey(end)) {
			if (pointInTime) {
				removedEntries.add(pointInTime);
			}
		} else if (pointInTime && entryDateKey(pointInTime) === startDateKey) {
			removedEntries.add(start);
			removedEntries.add(end);
		}
	}
	return entries.filter(entry => !removedEntries.has(entry));
}

/**
 * Runs a catalogue query on Wikidata and turns its rows into dated facts; results are cached per query.
 * Facts whose best-ranked statements give more than one distinct date are left out;
 * rows repeating one fact, such as one per image, are merged into its first;
 * overlapping point-in-time, start and end dates of one item are reduced as `reconcileEventDates` describes.
 *
 * @param sparql Query text whose `?sourceIndex` in each row indexes `dateSourceNames`.
 * @param dateSourceNames Date sources the query matches, in the order of its `?sourceIndex` values.
 * @returns One entry per fact.
 */
export async function runCatalogueQuery(
	sparql: string,
	dateSourceNames: readonly DateSourceName[]
): Promise<CatalogueEntry[]> {
	'use cache';
	cacheLife('max');

	const rows = await runSparqlQuery(sparql);

	const entriesByCard = new Map<string, CatalogueEntry[]>();
	for (const row of rows) {
		const entry = parseEntry(row, dateSourceNames);
		if (!entry) {
			continue;
		}
		const key = entryCardKey(entry);
		const cardEntries = entriesByCard.get(key);
		if (cardEntries) {
			cardEntries.push(entry);
		} else {
			entriesByCard.set(key, [entry]);
		}
	}

	const uniqueEntries = [...entriesByCard.values()].flatMap(entries => {
		const distinctDates = new Set(entries.map(entryDateKey));
		return distinctDates.size === 1 && entries[0] ? [entries[0]] : [];
	});
	return reconcileEventDates(uniqueEntries);
}
