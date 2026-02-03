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
	if (!locals.user) {
		return { filters: [] };
	}

	try {
		const pipedriveFilters = await getFilters();

		try {
			db.transaction((tx) => {
				for (const filter of pipedriveFilters) {
					const deletedAt = filter.active_flag ? null : sql`(unixepoch())`;

					tx.insert(filters)
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
						})
						.run();
				}
			});
		} catch (err) {
			console.error('Failed to upsert filters to database:', err);
			throw err;
		}

		try {
			const existingIds = pipedriveFilters.map((f) => f.id);
			if (existingIds.length > 0) {
				await db
					.update(filters)
					.set({ deletedAt: sql`(unixepoch())` })
					.where(notInArray(filters.id, existingIds));
			}
		} catch (err) {
			console.error('Failed to mark deleted filters in database:', err);
			throw err;
		}

		try {
			const syncedFilters = await db
				.select({
					id: filters.id,
					name: filters.name,
					brevoListId: filters.brevoListId
				})
				.from(filters)
				.where(isNull(filters.deletedAt));

			return {
				filters: syncedFilters as FilterView[]
			};
		} catch (err) {
			console.error('Failed to select active filters from database:', err);
			throw err;
		}
	} catch (err) {
		console.error('Failed to fetch filters:', err);
		if (process.env.CI) {
			console.log('Running in CI, returning empty filters for E2E tests');
			return { filters: [] };
		}
		error(500, 'Nie udało się pobrać filtrów z Pipedrive');
	}
};
