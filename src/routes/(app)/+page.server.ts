import { redirect } from '@sveltejs/kit';
import { getFilters } from '$lib/server/services/pipedrive.service';
import { db } from '$lib/server/db';
import { filters } from '$lib/server/db/schema';
import { isNull } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

interface FilterView {
	id: number;
	name: string;
	brevoListId: number | null;
}

export const load: PageServerLoad = async () => {
	try {
		const pipedriveFilters = await getFilters();

		// Fetch local filter mappings from DB to populate brevoListId
		const localFilters = await db
			.select({
				id: filters.id,
				brevoListId: filters.brevoListId
			})
			.from(filters)
			.where(isNull(filters.deletedAt));

		// Create a map of local filter id to brevoListId
		const brevoListIdMap = new Map<number, number | null>();
		for (const filter of localFilters) {
			brevoListIdMap.set(filter.id, filter.brevoListId);
		}

		// Merge Pipedrive filters with local brevoListId data
		const mergedFilters: FilterView[] = pipedriveFilters.map((filter) => ({
			id: filter.id,
			name: filter.name,
			brevoListId: brevoListIdMap.get(filter.id) ?? null
		}));

		return {
			filters: mergedFilters
		};
	} catch (error) {
		console.error('Failed to fetch filters:', error);
		redirect(307, '/error?message=fetch-failed');
	}
};
