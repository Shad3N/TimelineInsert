/**
 * App-wide types
 * Put here types that cannot be localized to only a small part of the app
 */

import type { cardImageSize } from '@/const';

export type UUID = `${string}-${string}-${string}-${string}-${string}`;

export type WikidataId = `Q${number}`;

export type WikidataPropertyId = `P${number}`;

/** Steps of date precision, coarsest first. */
export type DatePrecision =
	| 'billion-years'
	| 'hundred-million-years'
	| 'ten-million-years'
	| 'million-years'
	| 'hundred-thousand-years'
	| 'ten-thousand-years'
	| 'millennium'
	| 'century'
	| 'decade'
	| 'year'
	| 'month'
	| 'day';

/**
 * A date in historical numbering: negative years are BCE and there is no year 0.
 * Month is present from month precision on, day only at day precision.
 */
export type TimelineDate = {
	year: number;
	month?: number;
	day?: number;
	precision: DatePrecision;
	approximate: boolean;
};

/**
 * Where a card's date sits on its Wikidata item: directly on the item,
 * or as a qualifier of one of the item's statements.
 */
export type CardDateSource =
	| { type: 'item'; property: WikidataPropertyId }
	| {
			type: 'statement';
			statementProperty: WikidataPropertyId;
			statementValue: WikidataId;
			qualifierProperty: WikidataPropertyId;
	  };

export type TopicTag = {
	id: WikidataId;
	label: string;
};

export type TimelineCardImage = {
	id: UUID;
	author: string;
	license: string;
	sourceUrl: string;
	width: typeof cardImageSize.width;
	height: typeof cardImageSize.height;
};

export type TimelineCard = {
	id: UUID;
	/** Absent on cards an admin created by hand. */
	wikidata: { item: WikidataId; dateSource: CardDateSource } | null;
	title: string;
	description: string;
	date: TimelineDate;
	tags: TopicTag[];
	sitelinks: number;
	image: TimelineCardImage;
};
