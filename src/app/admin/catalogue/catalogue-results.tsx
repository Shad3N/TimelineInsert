import Link from 'next/link';
import { z } from 'zod';

import {
	parseCatalogueSearchParams,
	type RawSearchParams
} from '@/app/admin/catalogue/catalogue-search-params';
import type { CardDateSource, TimelineDate } from '@/types';
import { CardQuery } from '@/wikidata/card-query';
import type { CatalogueEntry } from '@/wikidata/catalogue-types';

const entriesPerPage = 50;

function formatTimelineDate(date: TimelineDate): string {
	const year = date.year < 0 ? `${-date.year} BCE` : String(date.year);
	const monthAndDay = [date.month, date.day]
		.filter(part => part !== undefined)
		.map(part => `-${String(part).padStart(2, '0')}`)
		.join('');
	return `${date.approximate ? 'c. ' : ''}${year}${monthAndDay}`;
}

function describeDateSource(dateSource: CardDateSource): string {
	return dateSource.type === 'item'
		? dateSource.property
		: `${dateSource.statementProperty} ${dateSource.statementValue} › ${dateSource.qualifierProperty}`;
}

function commonsThumbnailUrl(fileName: string): string {
	return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=160`;
}

function pageHref(rawSearchParams: RawSearchParams, page: number): string {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(rawSearchParams)) {
		for (const singleValue of [value ?? []].flat()) {
			params.append(key, singleValue);
		}
	}
	params.set('page', String(page));
	return `/admin/catalogue?${params}`;
}

/** Runs the catalogue query the URL describes and lists one page of its entries. */
export async function CatalogueResults({
	searchParams
}: {
	searchParams: Promise<RawSearchParams>;
}) {
	const rawSearchParams = await searchParams;
	const parsed = parseCatalogueSearchParams(rawSearchParams);
	if (!parsed.success) {
		return (
			<p className="whitespace-pre-line text-red-700">
				Filters not applied: {z.prettifyError(parsed.error)}
			</p>
		);
	}
	const {
		topic,
		location,
		minimumSitelinks,
		fromYear,
		toYear,
		image,
		dateSource,
		page
	} = parsed.data;
	if (topic.length === 0) {
		return <p>Pick a topic to query Wikidata.</p>;
	}

	let query = CardQuery.builder()
		.dateSources(...dateSource)
		.inAnyTopic(...topic);
	if (location.length > 0) {
		query = query.locatedIn(...location);
	}
	if (image === 'with') {
		query = query.withImage();
	}
	if (image === 'without') {
		query = query.withoutImage();
	}
	if (minimumSitelinks !== undefined) {
		query = query.minimumSitelinks(minimumSitelinks);
	}
	if (fromYear !== undefined) {
		query = query.fromYear(fromYear);
	}
	if (toYear !== undefined) {
		query = query.toYear(toYear);
	}

	let entries: CatalogueEntry[];
	try {
		entries = await query.execute();
	} catch (error) {
		return (
			<p className="text-red-700">
				Wikidata query failed:{' '}
				{error instanceof Error ? error.message : String(error)}
			</p>
		);
	}

	if (entries.length === 0) {
		return <p>No Wikidata items match these filters.</p>;
	}
	const pageCount = Math.ceil(entries.length / entriesPerPage);
	const pageEntries = entries.slice(
		(page - 1) * entriesPerPage,
		page * entriesPerPage
	);

	return (
		<section className="flex flex-col gap-4">
			<nav className="flex items-center gap-4">
				{page > 1 && (
					<Link href={pageHref(rawSearchParams, page - 1)}>Previous page</Link>
				)}
				<span>
					Page {page} of {pageCount} · {entries.length} entries
				</span>
				{page < pageCount && (
					<Link href={pageHref(rawSearchParams, page + 1)}>Next page</Link>
				)}
			</nav>
			{pageEntries.length === 0 && (
				<p>
					Page {page} is past the last page ({pageCount}).
				</p>
			)}
			<ul className="flex flex-col divide-y">
				{pageEntries.map(entry => (
					<li
						key={`${entry.item} ${describeDateSource(entry.dateSource)}`}
						className="flex gap-4 py-3"
					>
						<div className="w-40 shrink-0">
							{entry.imageFileName ? (
								<img
									src={commonsThumbnailUrl(entry.imageFileName)}
									alt={entry.label}
									width={160}
									loading="lazy"
								/>
							) : (
								<span className="text-sm text-gray-500">No image</span>
							)}
						</div>
						<div className="flex flex-col gap-1">
							<a
								href={`https://www.wikidata.org/wiki/${entry.item}`}
								className="font-medium underline"
							>
								{entry.title} ({entry.item})
							</a>
							<p className="text-sm font-medium text-amber-600 dark:text-amber-300">
								{formatTimelineDate(entry.date)} · precision:{' '}
								{entry.date.precision} · source:{' '}
								{describeDateSource(entry.dateSource)} · sitelinks:{' '}
								{entry.sitelinks}
							</p>
							{entry.description && (
								<p className="text-sm text-gray-500">{entry.description}</p>
							)}
						</div>
					</li>
				))}
			</ul>
		</section>
	);
}
