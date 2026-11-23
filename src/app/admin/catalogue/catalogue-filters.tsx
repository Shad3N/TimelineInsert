import Form from 'next/form';
import { connection } from 'next/server';

import {
	locationOptions,
	type PickOption,
	topicOptions
} from '@/app/admin/catalogue/catalogue-filter-options';
import {
	type RawSearchParams,
	splitPickedValues
} from '@/app/admin/catalogue/catalogue-search-params';
import { WikidataMultiSelect } from '@/app/admin/catalogue/wikidata-multi-select';
import { YearRangeSlider } from '@/app/admin/catalogue/year-range-slider';
import { dateSourceNames } from '@/wikidata/date-sources';

const imageFilterOptions = [
	{ value: '', label: 'Any' },
	{ value: 'with', label: 'With image' },
	{ value: 'without', label: 'Without image' }
] as const;

function firstValue(value: string | string[] | undefined): string {
	return [value ?? ''].flat()[0] ?? '';
}

/** Options picked in the URL value; a value missing from the fixed options is labelled with itself. */
function pickedOptions(
	value: string | string[] | undefined,
	fixedOptions: readonly PickOption[]
): PickOption[] {
	return splitPickedValues(value).map(
		pickedValue =>
			fixedOptions.find(option => option.value === pickedValue) ?? {
				value: pickedValue,
				label: pickedValue
			}
	);
}

/** The year a URL value names, or undefined when it names none. */
function optionalYear(
	value: string | string[] | undefined
): number | undefined {
	const year = Number(firstValue(value));
	return firstValue(value) !== '' && Number.isSafeInteger(year) && year !== 0
		? year
		: undefined;
}

/** Filter form prefilled from the URL; submitting it navigates to the first page of the new results. */
export async function CatalogueFilters({
	searchParams
}: {
	searchParams: Promise<RawSearchParams>;
}) {
	const rawSearchParams = await searchParams;
	await connection();
	const selectedImageFilter = firstValue(rawSearchParams['image']);
	const selectedDateSources = new Set(
		[rawSearchParams['dateSource'] ?? []].flat()
	);

	return (
		<Form action="/admin/catalogue" className="flex flex-col gap-4">
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
				<WikidataMultiSelect
					name="topic"
					label="Topics"
					description="Items that are part of a topic, a kind of it, or work in or are about it; any picked topic matches"
					fixedOptions={topicOptions}
					defaultPicked={pickedOptions(rawSearchParams['topic'], topicOptions)}
				/>
				<WikidataMultiSelect
					name="location"
					label="Locations"
					description="Places inside a picked place match too; any picked place matches"
					fixedOptions={locationOptions}
					defaultPicked={pickedOptions(
						rawSearchParams['location'],
						locationOptions
					)}
				/>
				<label className="flex flex-col gap-1">
					<span className="font-medium">Minimum sitelinks</span>
					<input
						name="minimumSitelinks"
						type="number"
						min={0}
						defaultValue={firstValue(rawSearchParams['minimumSitelinks'])}
						className="rounded border px-2 py-1"
					/>
				</label>
				<fieldset className="flex flex-col gap-1">
					<legend className="font-medium">Image</legend>
					<div className="flex self-start rounded border">
						{imageFilterOptions.map(({ value, label }) => (
							<label
								key={label}
								className="cursor-pointer px-3 py-1 has-checked:bg-gray-900 has-checked:text-white dark:has-checked:bg-white dark:has-checked:text-gray-900"
							>
								<input
									type="radio"
									name="image"
									value={value}
									defaultChecked={selectedImageFilter === value}
									className="sr-only"
								/>
								{label}
							</label>
						))}
					</div>
				</fieldset>
			</div>
			<YearRangeSlider
				latestSliderYear={new Date().getFullYear()}
				defaultFromYear={optionalYear(rawSearchParams['fromYear'])}
				defaultToYear={optionalYear(rawSearchParams['toYear'])}
			/>
			<fieldset className="flex flex-col gap-2">
				<legend className="font-medium">Date sources</legend>
				<span className="text-sm text-gray-500">None checked matches all.</span>
				<div className="flex flex-wrap gap-x-4 gap-y-1">
					{dateSourceNames.map(name => (
						<label key={name} className="flex items-center gap-1">
							<input
								type="checkbox"
								name="dateSource"
								value={name}
								defaultChecked={selectedDateSources.has(name)}
							/>
							{name}
						</label>
					))}
				</div>
			</fieldset>
			<button
				type="submit"
				className="self-start rounded bg-gray-900 px-4 py-1 text-white"
			>
				Search
			</button>
		</Form>
	);
}
