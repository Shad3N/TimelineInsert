'use client';

import { MultiSelect } from '@mantine/core';
import { useEffect, useState } from 'react';
import { z } from 'zod';

import type { PickOption } from '@/app/admin/catalogue/catalogue-filter-options';
import {
	pickedValuesSeparator,
	wikidataIdSchema
} from '@/app/admin/catalogue/catalogue-search-params';
import { wikimediaUserAgent } from '@/const';

const searchDelayMilliseconds = 300;

const fixedOptionsShown = 50;

const searchResponseSchema = z.object({
	search: z.array(
		z.object({
			id: wikidataIdSchema,
			label: z.string().optional(),
			description: z.string().optional()
		})
	)
});

async function searchWikidataItems(
	text: string,
	signal: AbortSignal
): Promise<PickOption[]> {
	const url = new URL('https://www.wikidata.org/w/api.php');
	url.search = new URLSearchParams({
		action: 'wbsearchentities',
		search: text,
		language: 'en',
		uselang: 'en',
		type: 'item',
		limit: '10',
		format: 'json',
		origin: '*'
	}).toString();
	const response = await fetch(url, {
		signal,
		headers: { 'Api-User-Agent': wikimediaUserAgent }
	});
	if (!response.ok) {
		throw new Error(`Wikidata search failed with status ${response.status}`);
	}
	return searchResponseSchema
		.parse(await response.json())
		.search.map(result => ({
			value: result.id,
			label: result.label ?? result.id,
			...(result.description && { description: result.description })
		}));
}

function uniqueByValue(options: readonly PickOption[]): PickOption[] {
	return [...new Map(options.map(option => [option.value, option])).values()];
}

/**
 * Multi-pick field of Wikidata items submitting the picked values joined into one form value.
 * Typing filters the fixed options and also searches Wikidata; each pick shows as a chip.
 */
export function WikidataMultiSelect({
	name,
	label,
	description,
	fixedOptions,
	defaultPicked
}: {
	name: string;
	label: string;
	description: string;
	fixedOptions: readonly PickOption[];
	defaultPicked: readonly PickOption[];
}) {
	const [picked, setPicked] = useState<readonly PickOption[]>(defaultPicked);
	const [searchText, setSearchText] = useState('');
	const [searchResults, setSearchResults] = useState<PickOption[]>([]);
	const [searchError, setSearchError] = useState<string | null>(null);
	const trimmedText = searchText.trim();

	useEffect(() => {
		if (trimmedText === '') {
			return;
		}
		const controller = new AbortController();
		async function search() {
			try {
				setSearchResults(
					await searchWikidataItems(trimmedText, controller.signal)
				);
				setSearchError(null);
			} catch (error) {
				if (controller.signal.aborted) {
					return;
				}
				setSearchResults([]);
				setSearchError(error instanceof Error ? error.message : String(error));
			}
		}
		const timeout = setTimeout(() => void search(), searchDelayMilliseconds);
		return () => {
			clearTimeout(timeout);
			controller.abort();
		};
	}, [trimmedText]);

	const lowercaseText = trimmedText.toLowerCase();
	const matchingFixedOptions = fixedOptions
		.filter(option => option.label.toLowerCase().includes(lowercaseText))
		.slice(0, fixedOptionsShown);
	const shownSearchResults = trimmedText === '' ? [] : searchResults;
	const options = uniqueByValue([
		...picked,
		...matchingFixedOptions,
		...shownSearchResults
	]);
	const optionsByValue = new Map(options.map(option => [option.value, option]));

	return (
		<MultiSelect
			name={name}
			label={label}
			description={description}
			data={options}
			value={picked.map(option => option.value)}
			onChange={values =>
				setPicked(
					values.flatMap(value => {
						const option = optionsByValue.get(value);
						return option ? [option] : [];
					})
				)
			}
			searchable
			searchValue={searchText}
			onSearchChange={setSearchText}
			filter={({ options: unfilteredOptions }) => unfilteredOptions}
			hidePickedOptions
			clearable
			hiddenInputValuesDivider={pickedValuesSeparator}
			maxDropdownHeight={320}
			nothingFoundMessage="No matching items"
			error={searchError && `Wikidata search failed: ${searchError}`}
			renderOption={({ option }) => {
				const optionDescription = optionsByValue.get(option.value)?.description;
				return (
					<span className="flex flex-col">
						<span>{option.label}</span>
						{optionDescription && (
							<span className="text-xs opacity-60">{optionDescription}</span>
						)}
					</span>
				);
			}}
		/>
	);
}
