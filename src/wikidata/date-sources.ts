import type { CatalogueDateSource } from '@/wikidata/catalogue-types';

/** Every kind of date the game draws cards from, keyed by the name callers select it with. */
export const dateSourcesByName = {
	'point-in-time': { type: 'item', property: 'P585' },
	'start': { type: 'item', property: 'P580' },
	'end': { type: 'item', property: 'P582' },
	'inception': { type: 'item', property: 'P571' },
	'dissolution': { type: 'item', property: 'P576' },
	'opening': { type: 'item', property: 'P1619' },
	'birth': { type: 'item', property: 'P569' },
	'death': { type: 'item', property: 'P570' },
	'publication': { type: 'item', property: 'P577' },
	'discovery': { type: 'item', property: 'P575' },
	'first-flight': { type: 'item', property: 'P606' },
	'service-entry': { type: 'item', property: 'P729' },
	'service-retirement': { type: 'item', property: 'P730' },
	'launch': { type: 'item', property: 'P619' },
	'effective-date': { type: 'item', property: 'P7588' },
	'position-start': {
		type: 'statement',
		statementProperty: 'P39',
		qualifierProperty: 'P580'
	},
	'award': {
		type: 'statement',
		statementProperty: 'P166',
		qualifierProperty: 'P585'
	},
	'significant-event': {
		type: 'statement',
		statementProperty: 'P793',
		qualifierProperty: 'P585'
	}
} as const satisfies Record<string, CatalogueDateSource>;

export type DateSourceName = keyof typeof dateSourcesByName;

export const dateSourceNames = Object.keys(
	dateSourcesByName
) as DateSourceName[];
