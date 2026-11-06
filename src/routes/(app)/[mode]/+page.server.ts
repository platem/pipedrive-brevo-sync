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
import {
	elapsedMs,
	logSync,
	sanitizeMessage,
	SyncFailure,
	type SyncLogContext,
	type SyncMode
} from '$lib/server/services/sync-log';
import type { Actions, PageServerLoad } from './$types';

function actionFailureContext(mode: SyncMode, filterIds: number[]): SyncLogContext {
	return {
		mode,
		filterId: filterIds.length === 1 ? filterIds[0] : null,
		jobId: null
	};
}

function safeFailureMessage(err: unknown, stage: string): string {
	return err instanceof SyncFailure ? sanitizeMessage(err.message) : `Sync failed during ${stage}`;
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const loadStartedAt = performance.now();

	if (!locals.user) {
		return redirect(302, '/login');
	}
	const mode = params.mode;

	if (mode !== 'new' && mode !== 'overwrite') {
		error(404, 'Nie znaleziono strony');
	}

	try {
		const activeJobs = await db.select().from(syncJobs).where(eq(syncJobs.status, 'processing'));
		const hasActiveJob = activeJobs.length > 0;

		return {
			mode: mode as 'new' | 'overwrite',
			hasActiveJob
		};
	} catch {
		logSync({
			level: 'error',
			event: 'sync.load_failed',
			stage: 'db_check',
			durationMs: elapsedMs(loadStartedAt),
			mode,
			message: 'Database check failed'
		});
		error(500, 'Błąd bazy danych');
	}
};

export const actions: Actions = {
	sync: async ({ request, params }) => {
		const actionStartedAt = performance.now();
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

		try {
			const activeJobs = await db.select().from(syncJobs).where(eq(syncJobs.status, 'processing'));
			if (activeJobs.length > 0) {
				return fail(409, { error: 'Synchronizacja w toku. Spróbuj ponownie później.' });
			}
		} catch {
			logSync({
				...actionFailureContext(mode, filterIds),
				level: 'error',
				event: 'sync.rejected',
				stage: 'db_check',
				durationMs: elapsedMs(actionStartedAt),
				message: 'Database check failed'
			});
			return fail(500, { error: 'Błąd bazy danych podczas sprawdzania statusu' });
		}

		let selectedFilters;
		try {
			selectedFilters = await db.select().from(filters).where(inArray(filters.id, filterIds));
		} catch {
			logSync({
				...actionFailureContext(mode, filterIds),
				level: 'error',
				event: 'sync.rejected',
				stage: 'db_filters',
				durationMs: elapsedMs(actionStartedAt),
				message: 'Database filter lookup failed'
			});
			return fail(500, { error: 'Błąd bazy danych podczas pobierania filtrów' });
		}

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
				const filterStartedAt = performance.now();
				const filterRecord = selectedFilters.find((f) => f.id === job.filterId);
				const context: SyncLogContext = {
					filterId: job.filterId,
					jobId: job.id,
					mode,
					brevoListId: filterRecord?.brevoListId ?? undefined
				};
				let stage = 'prepare';

				logSync({
					...context,
					event: 'sync.start',
					stage: 'job',
					durationMs: elapsedMs(filterStartedAt)
				});

				try {
					let brevoListId: number;
					if (!filterRecord) {
						throw new SyncFailure(`Nie znaleziono filtra ${job.filterId}`);
					}

					if (mode === 'new') {
						stage = 'create_list';
						const list = await createList(filterRecord.name, context);
						brevoListId = list.id;
						context.brevoListId = brevoListId;

						stage = 'persist_list_id';
						await db.update(filters).set({ brevoListId }).where(eq(filters.id, job.filterId));
					} else {
						if (!filterRecord || !filterRecord.brevoListId) {
							throw new SyncFailure(`Brak brevo_list_id dla filtra ${job.filterId}`);
						}
						brevoListId = filterRecord.brevoListId;
						stage = 'clear_list';
						await emptyList(brevoListId, context);
					}

					stage = 'pipedrive_deals';
					const dealsStartedAt = performance.now();
					const deals = await getDealsByFilter(job.filterId);

					logSync({
						...context,
						event: 'pipedrive.deals',
						stage: 'pipedrive',
						durationMs: elapsedMs(dealsStartedAt),
						deals: deals.length
					});

					stage = 'pipedrive_persons';
					const personsStartedAt = performance.now();
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

					logSync({
						...context,
						event: 'pipedrive.contacts',
						stage: 'pipedrive',
						durationMs: elapsedMs(personsStartedAt),
						persons: persons.length,
						contacts: contacts.length
					});

					stage = 'import';
					const result = await importContacts(brevoListId, contacts, context);
					totalSent += result.imported;

					stage = 'persist';
					await db
						.update(syncJobs)
						.set({
							status: 'completed',
							completedAt: new Date(),
							totalFetched: deals.length,
							totalAdded: result.imported
						})
						.where(eq(syncJobs.id, job.id));

					logSync({
						...context,
						event: 'sync.finished',
						stage: 'job',
						durationMs: elapsedMs(filterStartedAt),
						status: 'completed',
						totalFetched: deals.length,
						submittedContacts: result.imported
					});
				} catch (err) {
					const errorMessage = safeFailureMessage(err, stage);
					logSync({
						...context,
						level: 'error',
						event: 'sync.failed',
						stage,
						durationMs: elapsedMs(filterStartedAt),
						status: 'failed',
						message: errorMessage
					});

					failedFilters.push(job.filterId.toString());

					try {
						await db
							.update(syncJobs)
							.set({
								status: 'failed',
								errorMessage
							})
							.where(eq(syncJobs.id, job.id));
					} catch {
						logSync({
							...context,
							level: 'error',
							event: 'sync.persist_failed',
							stage: 'persist_failed',
							durationMs: elapsedMs(filterStartedAt),
							message: 'Failed to record failed job status'
						});
					}
				}
			}

			return {
				success: true,
				totalSent,
				failedFilters
			};
		} catch {
			logSync({
				...actionFailureContext(mode, filterIds),
				level: 'error',
				event: 'sync.rejected',
				stage: 'job_creation',
				durationMs: elapsedMs(actionStartedAt),
				message: 'Database job creation failed'
			});
			return fail(500, { error: 'Błąd bazy danych podczas tworzenia zadań' });
		}
	}
};
