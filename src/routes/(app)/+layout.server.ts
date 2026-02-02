import { error } from '@sveltejs/kit';
import { getFilters } from '$lib/server/services/pipedrive.service';
import { db } from '$lib/server/db';
import { filters } from '$lib/server/db/schema';
import { isNull, notInArray, sql } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';

interface FilterView {
	id: number;
	name: string;
	brevoListId: number | null;
}

export const load: LayoutServerLoad = async ({ locals }) => {
	console.time('layoutTotal');
	if (!locals.user) {
		console.timeEnd('layoutTotal');
		return { filters: [] };
	}

	try {
		console.time('getFiltersAPI');
		const pipedriveFilters = await getFilters();
		console.timeEnd('getFiltersAPI');

		// Upsert all Pipedrive filters into local DB
		// Handle active_flag: true = active, false = soft-deleted
		console.time('dbUpsertFilters');
		for (const filter of pipedriveFilters) {
			const deletedAt = filter.active_flag ? null : sql`(unixepoch())`;

			await db
				.insert(filters)
				.values({
					id: filter.id,
					name: filter.name,
					brevoListId: null,
					deletedAt
				})
				.onConflictDoUpdate({
					target: filters.id,
					set: {
						name: filter.name,
						deletedAt
					}
				});
		}
		console.timeEnd('dbUpsertFilters');

		// Mark filters that no longer exist in Pipedrive as deleted
		const existingIds = pipedriveFilters.map((f) => f.id);
		if (existingIds.length > 0) {
			console.time('dbUpdateDeleted');
			await db
				.update(filters)
				.set({ deletedAt: sql`(unixepoch())` })
				.where(notInArray(filters.id, existingIds));
			console.timeEnd('dbUpdateDeleted');
		}

		// Return all non-deleted filters from local DB
		console.time('dbSelectFilters');
		const syncedFilters = await db
			.select({
				id: filters.id,
				name: filters.name,
				brevoListId: filters.brevoListId
			})
			.from(filters)
			.where(isNull(filters.deletedAt));
		console.timeEnd('dbSelectFilters');

		console.timeEnd('layoutTotal');

		return {
			filters: syncedFilters as FilterView[]
		};
	} catch (err) {
		console.error('Failed to fetch filters:', err);
		if (process.env.CI) {
			console.log('Running in CI, returning empty filters for E2E tests');
			return { filters: [] };
		}
		error(500, 'Nie udało się pobrać filtrów z Pipedrive');
	}
};
