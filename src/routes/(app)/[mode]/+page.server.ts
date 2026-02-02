import { error, fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { filters, syncJobs } from '$lib/server/db/schema';
import { eq, inArray } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const mode = params.mode;

	if (mode !== 'new' && mode !== 'overwrite') {
		error(404, 'Nie znaleziono strony');
	}

	const activeJobs = await db.select().from(syncJobs).where(eq(syncJobs.status, 'processing'));
	const hasActiveJob = activeJobs.length > 0;

	return {
		mode: mode as 'new' | 'overwrite',
		hasActiveJob
	};
};

export const actions: Actions = {
	sync: async ({ request, params }) => {
		const mode = params.mode as 'new' | 'overwrite';

		const formData = await request.formData();
		const filterIdsRaw = formData.getAll('filterIds');

		if (!filterIdsRaw || filterIdsRaw.length === 0) {
			return fail(400, { error: 'Brak wybranych filtrów' });
		}

		const filterIds = filterIdsRaw.map((id) => Number(id)).filter((id) => !isNaN(id) && id > 0);

		if (filterIds.length === 0) {
			return fail(400, { error: 'Nieprawidłowe ID filtrów' });
		}

		const activeJobs = await db.select().from(syncJobs).where(eq(syncJobs.status, 'processing'));
		if (activeJobs.length > 0) {
			return fail(409, { error: 'Synchronizacja w toku. Spróbuj ponownie później.' });
		}

		const selectedFilters = await db.select().from(filters).where(inArray(filters.id, filterIds));

		const invalidFilters = selectedFilters.filter((filter) => {
			const hasBrevoListId = filter.brevoListId !== null;
			if (mode === 'new') {
				return hasBrevoListId || filter.deletedAt !== null;
			} else {
				return !hasBrevoListId || filter.deletedAt !== null;
			}
		});

		if (invalidFilters.length > 0) {
			return fail(400, { error: 'Nieprawidłowe wybrane filtry' });
		}

		try {
			const jobs = await db
				.insert(syncJobs)
				.values(
					filterIds.map((filterId) => ({
						filterId,
						status: 'processing'
					}))
				)
				.returning();

			if (jobs.length !== filterIds.length) {
				return fail(500, { error: 'Nie udało się utworzyć zadania synchronizacji' });
			}
		} catch (err) {
			console.error('Failed to create sync jobs:', err);
			return fail(500, { error: 'Błąd bazy danych podczas tworzenia zadań' });
		}

		return {
			success: true,
			totalSent: 0,
			failedFilters: []
		};
	}
};
