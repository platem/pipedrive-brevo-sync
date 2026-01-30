import { redirect } from '@sveltejs/kit';
import { getFilters } from '$lib/server/services/pipedrive.service';
import { db } from '$lib/server/db';
import { filters } from '$lib/server/db/schema';
import { isNull, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

interface FilterView {
	id: number;
	name: string;
	brevoListId: number | null;
}

export const load: PageServerLoad = async () => {
	try {
		const pipedriveFilters = await getFilters();

		// Upsert all Pipedrive filters into local DB
		// Handle active_flag: true = active, false = soft-deleted
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

		// Mark filters that no longer exist in Pipedrive as deleted
		const existingIds = pipedriveFilters.map((f) => f.id);
		await db
			.update(filters)
			.set({ deletedAt: sql`(unixepoch())` })
			.where(sql`${filters.id} NOT IN (${existingIds.join(',')})`);

		// Return all non-deleted filters from local DB
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
	} catch (error) {
		console.error('Failed to fetch filters:', error);
		redirect(307, '/error?message=fetch-failed');
	}
};
