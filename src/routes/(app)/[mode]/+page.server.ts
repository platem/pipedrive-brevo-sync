import { error, fail } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { filters, syncJobs } from '$lib/server/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { getDealsByFilter, getPersons } from '$lib/server/services/pipedrive.service';
import {
	createList,
	emptyList,
	importContacts,
	type BrevoContact
} from '$lib/server/services/brevo.service';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		return redirect(302, '/login');
	}
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

			let totalSent = 0;
			const failedFilters: string[] = [];

			for (const job of jobs) {
				try {
					let brevoListId: number;
					const filterRecord = selectedFilters.find((f) => f.id === job.filterId);
					if (!filterRecord) {
						throw new Error(`Nie znaleziono filtra ${job.filterId}`);
					}

					if (mode === 'new') {
						const list = await createList(filterRecord.name);
						brevoListId = list.id;

						await db.update(filters).set({ brevoListId }).where(eq(filters.id, job.filterId));
					} else {
						if (!filterRecord || !filterRecord.brevoListId) {
							throw new Error(`Brak brevo_list_id dla filtra ${job.filterId}`);
						}
						brevoListId = filterRecord.brevoListId;
						await emptyList(brevoListId);
					}

					const deals = await getDealsByFilter(job.filterId);

					const personIds = [...new Set(deals.map((d) => d.person_id).filter((id) => id !== null))];
					const persons = await getPersons(personIds as number[]);

					const contacts: BrevoContact[] = [];
					for (const person of persons) {
						if (person.is_deleted) {
							continue;
						}

						const email = person.emails.find((e) => e.primary)?.value || person.emails[0]?.value;
						if (!email) {
							continue;
						}

						contacts.push({
							email,
							attributes: {
								FIRSTNAME: person.first_name,
								LASTNAME: person.last_name,
								EXT_ID: person.id.toString()
							}
						});
					}

					const result = await importContacts(brevoListId, contacts);
					totalSent += result.imported;

					await db
						.update(syncJobs)
						.set({
							status: 'completed',
							completedAt: new Date(),
							totalFetched: deals.length,
							totalAdded: result.imported
						})
						.where(eq(syncJobs.id, job.id));
				} catch (err) {
					const errorMessage = err instanceof Error ? err.message : 'Nieznany błąd';
					console.error(`Sync failed for filter ${job.filterId}:`, err);

					failedFilters.push(job.filterId.toString());

					await db
						.update(syncJobs)
						.set({
							status: 'failed',
							errorMessage
						})
						.where(eq(syncJobs.id, job.id));
				}
			}

			return {
				success: true,
				totalSent,
				failedFilters
			};
		} catch (err) {
			console.error('Failed to create sync jobs:', err);
			return fail(500, { error: 'Błąd bazy danych podczas tworzenia zadań' });
		}
	}
};
