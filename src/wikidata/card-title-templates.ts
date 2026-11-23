import type { DateSourceName } from '@/wikidata/date-sources';

/** Card sentence per date source; `{item}` stands for the item's label, `{value}` for the dated statement's value. */
const cardTitleTemplates = {
	'point-in-time': '{item} takes place',
	'start': '{item} begins',
	'end': '{item} ends',
	'inception': '{item} is founded',
	'dissolution': '{item} is dissolved',
	'opening': '{item} opens',
	'birth': '{item} is born',
	'death': '{item} dies',
	'publication': '{item} is published',
	'discovery': '{item} is discovered',
	'first-flight': '{item} makes its first flight',
	'service-entry': '{item} enters service',
	'service-retirement': '{item} is retired from service',
	'launch': '{item} is launched',
	'effective-date': '{item} takes effect',
	'position-start': '{item} becomes {value}',
	'award': '{item} receives {value}',
	'significant-event': '{item}: {value}'
} as const satisfies Record<DateSourceName, string>;

/**
 * Fills the date source's sentence template with the item's label and, for a date on
 * another statement, the label of that statement's value.
 */
export function buildCardTitle(
	dateSourceName: DateSourceName,
	itemLabel: string,
	statementValueLabel: string | null
): string {
	return cardTitleTemplates[dateSourceName]
		.replace('{item}', () => itemLabel)
		.replace('{value}', () => statementValueLabel ?? '');
}
