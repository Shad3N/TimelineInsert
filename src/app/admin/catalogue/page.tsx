import { Suspense } from 'react';

import { CatalogueFilters } from '@/app/admin/catalogue/catalogue-filters';
import { CatalogueResults } from '@/app/admin/catalogue/catalogue-results';

export default function CataloguePage({
	searchParams
}: PageProps<'/admin/catalogue'>) {
	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
			<h1 className="text-2xl font-semibold">Wikidata catalogue</h1>
			<Suspense>
				<CatalogueFilters searchParams={searchParams} />
			</Suspense>
			<Suspense fallback={<p>Querying Wikidata…</p>}>
				<CatalogueResults searchParams={searchParams} />
			</Suspense>
		</main>
	);
}
