import { z } from 'zod';

import type { WikidataId } from '@/types';
import { dateSourceNames } from '@/wikidata/date-sources';

/** Search params of a page, as Next.js passes them. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

export const wikidataIdSchema = z.custom<WikidataId>(
	value => typeof value === 'string' && /^Q\d+$/.test(value),
	'Expected a Wikidata item id such as Q362'
);

const timelineYearSchema = z.coerce
	.number()
	.int()
	.refine(year => year !== 0, 'Expected a year other than 0; 1 BCE is -1');

const imageFilterValues = ['with', 'without'] as const;

/** Separates the picked values of one multi-pick field in the URL. */
export const pickedValuesSeparator = ',';

/** Joins the ids of one topic that must all hold, as in `Q362-Q178561`. */
export const topicIdsSeparator = '-';

/** Values of one multi-pick field: every URL value split at the separator, empty parts dropped. */
export function splitPickedValues(
	value: string | string[] | undefined
): string[] {
	return [value ?? []]
		.flat()
		.flatMap(singleValue => singleValue.split(pickedValuesSeparator))
		.filter(part => part !== '');
}

const pickedValuesSchema = z.preprocess(
	value => splitPickedValues(value as string | string[] | undefined),
	z.array(z.string())
);

const catalogueSearchParamsSchema = z.object({
	topic: pickedValuesSchema.pipe(
		z.array(
			z
				.string()
				.transform(value => value.split(topicIdsSeparator))
				.pipe(z.array(wikidataIdSchema))
		)
	),
	location: pickedValuesSchema.pipe(z.array(wikidataIdSchema)),
	minimumSitelinks: z.coerce.number().int().nonnegative().optional(),
	fromYear: timelineYearSchema.optional(),
	toYear: timelineYearSchema.optional(),
	image: z.enum(imageFilterValues).optional(),
	dateSource: z
		.preprocess(
			value => (typeof value === 'string' ? [value] : value),
			z.array(z.enum(dateSourceNames))
		)
		.default([]),
	page: z.coerce.number().int().positive().default(1)
});

/** Validates catalogue filters from the URL; an empty value counts as absent. */
export function parseCatalogueSearchParams(rawSearchParams: RawSearchParams) {
	const presentParams = Object.fromEntries(
		Object.entries(rawSearchParams).filter(
			([, value]) => value !== undefined && value !== ''
		)
	);
	return catalogueSearchParamsSchema.safeParse(presentParams);
}
