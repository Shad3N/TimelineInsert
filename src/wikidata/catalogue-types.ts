import type {
	CardDateSource,
	TimelineDate,
	WikidataId,
	WikidataPropertyId
} from '@/types';

/** A kind of date to look for, without the statement value each matching item fills in. */
export type CatalogueDateSource =
	| { type: 'item'; property: WikidataPropertyId }
	| {
			type: 'statement';
			statementProperty: WikidataPropertyId;
			qualifierProperty: WikidataPropertyId;
	  };

/** One dated Wikidata fact  */
export type CatalogueEntry = {
	item: WikidataId;
	dateSource: CardDateSource;
	label: string;
	/** Default card text: the item's label put into its date source's sentence. */
	title: string;
	/** Absent when the item has no English description. */
	description: string | null;
	date: TimelineDate;
	/** Absent when the item has no image. */
	imageFileName: string | null;
	sitelinks: number;
};
