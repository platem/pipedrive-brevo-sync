import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { filters, syncJobs } from '../../../src/lib/server/db/schema';
import { actions } from '../../../src/routes/(app)/[mode]/+page.server';
import { createFakeBrevo, silenceConsole, type FakeBrevo } from '../fake-runtime';

vi.mock('$env/static/private', () => ({
	BREVO_API_KEY: 'test-brevo-api-key-sentinel',
	BREVO_FOLDER_ID: '7'
}));

const runtime = vi.hoisted(() => {
	const paramValues = (condition: unknown): unknown[] => {
		const found: unknown[] = [];
		const walk = (node: unknown) => {
			if (!node || typeof node !== 'object') return;
			if (node.constructor?.name === 'Param') {
				found.push((node as { value?: unknown }).value);
				return;
			}
			const chunks = (node as { queryChunks?: unknown[] }).queryChunks;
			if (Array.isArray(chunks)) {
				for (const child of chunks) walk(child);
			}
		};
		walk(condition);
		return found;
	};

	return {
		paramValues,
		activeJobs: [] as Array<Record<string, unknown>>,
		filters: [] as Array<Record<string, unknown>>,
		jobIds: [] as number[],
		writes: [] as Array<{ table: unknown; values: Record<string, unknown>; params: unknown[] }>
	};
});

vi.mock('$lib/server/db', async () => {
	const { syncJobs: syncJobsTable } = await import('$lib/server/db/schema');

	return {
		db: {
			select: () => ({
				from: (table: unknown) => ({
					where: async () => (table === syncJobsTable ? runtime.activeJobs : runtime.filters)
				})
			}),
			insert: () => ({
				values: (rows: Array<Record<string, unknown>>) => ({
					returning: async () => rows.map((row, index) => ({ ...row, id: runtime.jobIds[index] }))
				})
			}),
			update: (table: unknown) => ({
				set: (values: Record<string, unknown>) => ({
					where: async (condition: unknown) => {
						runtime.writes.push({
							table,
							values,
							params: runtime.paramValues(condition)
						});
					}
				})
			})
		}
	};
});

const pipedrive = vi.hoisted(() => ({
	deals: new Map<number, Array<{ person_id: number }>>(),
	persons: new Map<number, Array<Record<string, unknown>>>(),
	fetchedFilters: [] as number[]
}));

vi.mock('$lib/server/services/pipedrive.service', () => ({
	getDealsByFilter: async (filterId: number) => {
		pipedrive.fetchedFilters.push(filterId);
		return pipedrive.deals.get(filterId) ?? [];
	},
	getPersons: async (personIds: number[]) =>
		personIds.flatMap((personId) => pipedrive.persons.get(personId) ?? [])
}));

const LIST_412_CONTACTS = '/v3/contacts/lists/412/contacts';
const LIST_412_REMOVE = '/v3/contacts/lists/412/contacts/remove';
const LIST_413_CONTACTS = '/v3/contacts/lists/413/contacts';
const IMPORT_PATH = '/v3/contacts/import';
const CREATE_PATH = '/v3/contacts/lists';
const OBSERVED_400_BODY = {
	code: 'invalid_parameter',
	message: 'Contacts already removed from list and/or does not exist'
};

let restoreConsole: () => void;

beforeEach(() => {
	runtime.activeJobs = [];
	runtime.filters = [];
	runtime.jobIds = [];
	runtime.writes = [];
	pipedrive.deals.clear();
	pipedrive.persons.clear();
	pipedrive.fetchedFilters = [];
	restoreConsole = silenceConsole();
});

afterEach(() => {
	restoreConsole();
	vi.unstubAllGlobals();
});

function stubBrevo(handler: Parameters<typeof createFakeBrevo>[0]): FakeBrevo {
	const brevo = createFakeBrevo(handler);
	vi.stubGlobal('fetch', brevo.fetch);
	return brevo;
}

async function runSync(mode: 'new' | 'overwrite', filterIds: number[]) {
	const formData = new FormData();
	for (const filterId of filterIds) formData.append('filterIds', String(filterId));
	return actions.sync!({ params: { mode }, request: { formData: async () => formData } } as never);
}

function person(id: number, email: string) {
	return {
		id,
		first_name: 'Test',
		last_name: 'Person',
		is_deleted: false,
		emails: [{ value: email, primary: true }]
	};
}

function jobWrites() {
	return runtime.writes.filter((write) => write.table === syncJobs);
}

function filterWrites() {
	return runtime.writes.filter((write) => write.table === filters);
}

function writeForJob(jobId: number) {
	return jobWrites().find((write) => write.params.includes(jobId));
}

describe('[mode]/+page.server.ts sync action', () => {
	it('repopulates an overwrite list confirmed empty without calling removal', async () => {
		runtime.filters = [{ id: 177387, name: 'Hurtownia', brevoListId: 412, deletedAt: null }];
		runtime.jobIds = [501];
		pipedrive.deals.set(177387, [{ person_id: 9001 }]);
		pipedrive.persons.set(9001, [person(9001, 'contact.one@example.com')]);

		const brevo = stubBrevo((request) => {
			if (request.method === 'GET' && request.path === LIST_412_CONTACTS) {
				return { json: { contacts: [], count: 0 } };
			}
			if (request.method === 'POST' && request.path === IMPORT_PATH) {
				return { status: 202, json: { processId: 9001 } };
			}
			if (request.method === 'POST' && request.path === LIST_412_REMOVE) {
				return { status: 201, json: { processId: 9400, total: 0 } };
			}
			throw new Error(`Unexpected Brevo request ${request.method} ${request.path}`);
		});

		const result = await runSync('overwrite', [177387]);

		expect(brevo.requestsTo('POST', LIST_412_REMOVE)).toHaveLength(0);
		expect(result).toEqual({ success: true, totalSent: 1, failedFilters: [] });
		const imports = brevo.requestsTo('POST', IMPORT_PATH);
		expect(imports).toHaveLength(1);
		expect(imports[0].body).toMatchObject({ listIds: [412] });
		expect(writeForJob(501)?.values).toMatchObject({
			status: 'completed',
			totalFetched: 1,
			totalAdded: 1
		});
	});

	it('repopulates an overwrite list after the exact observed 400 is rechecked empty', async () => {
		runtime.filters = [{ id: 177387, name: 'Hurtownia', brevoListId: 412, deletedAt: null }];
		runtime.jobIds = [502];
		pipedrive.deals.set(177387, [{ person_id: 9002 }]);
		pipedrive.persons.set(9002, [person(9002, 'contact.two@example.com')]);

		let preflightCount = 0;
		const brevo = stubBrevo((request) => {
			if (request.method === 'GET' && request.path === LIST_412_CONTACTS) {
				preflightCount += 1;
				return {
					json:
						preflightCount === 1
							? { contacts: [{ email: 'member@example.com' }], count: 1 }
							: { contacts: [], count: 0 }
				};
			}
			if (request.method === 'POST' && request.path === LIST_412_REMOVE) {
				return { status: 400, statusText: 'Bad Request', json: OBSERVED_400_BODY };
			}
			if (request.method === 'POST' && request.path === IMPORT_PATH) {
				return { status: 202, json: { processId: 9100 } };
			}
			throw new Error(`Unexpected Brevo request ${request.method} ${request.path}`);
		});

		const result = await runSync('overwrite', [177387]);

		expect(brevo.requestsTo('POST', IMPORT_PATH)).toHaveLength(1);
		expect(result).toEqual({ success: true, totalSent: 1, failedFilters: [] });
		expect(brevo.requestsTo('POST', LIST_412_REMOVE)).toHaveLength(1);
		expect(brevo.requestsTo('GET', LIST_412_CONTACTS)).toHaveLength(2);
		expect(writeForJob(502)?.values).toMatchObject({ status: 'completed', totalAdded: 1 });
	});

	it('keeps new mode creating a list and importing without any list preflight', async () => {
		runtime.filters = [{ id: 88, name: 'Nowy', brevoListId: null, deletedAt: null }];
		runtime.jobIds = [503];
		pipedrive.deals.set(88, [{ person_id: 9003 }]);
		pipedrive.persons.set(9003, [person(9003, 'contact.three@example.com')]);

		const brevo = stubBrevo((request) => {
			if (request.method === 'POST' && request.path === CREATE_PATH) {
				return { status: 201, json: { id: 5001 } };
			}
			if (request.method === 'POST' && request.path === IMPORT_PATH) {
				return { status: 202, json: { processId: 9200 } };
			}
			throw new Error(`Unexpected Brevo request ${request.method} ${request.path}`);
		});

		const result = await runSync('new', [88]);

		expect(result).toEqual({ success: true, totalSent: 1, failedFilters: [] });
		expect(brevo.requests.filter((request) => request.method === 'GET')).toHaveLength(0);
		expect(filterWrites()).toHaveLength(1);
		expect(filterWrites()[0].params).toContain(88);
		expect(filterWrites()[0].values).toMatchObject({ brevoListId: 5001 });
		expect(writeForJob(503)?.values).toMatchObject({ status: 'completed', totalAdded: 1 });
	});

	it('records the failed first filter and still processes the second', async () => {
		runtime.filters = [
			{ id: 111, name: 'Pierwszy', brevoListId: 412, deletedAt: null },
			{ id: 222, name: 'Drugi', brevoListId: 413, deletedAt: null }
		];
		runtime.jobIds = [601, 602];
		pipedrive.deals.set(222, [{ person_id: 9004 }]);
		pipedrive.persons.set(9004, [person(9004, 'contact.four@example.com')]);

		const brevo = stubBrevo((request) => {
			if (request.method === 'GET' && request.path === LIST_412_CONTACTS) {
				return { json: { contacts: [{ email: 'member@example.com' }], count: 1 } };
			}
			if (request.method === 'POST' && request.path === LIST_412_REMOVE) {
				return {
					status: 404,
					statusText: 'Not Found',
					json: { code: 'document_not_found', message: 'List ID not found' }
				};
			}
			if (request.method === 'GET' && request.path === LIST_413_CONTACTS) {
				return { json: { contacts: [], count: 0 } };
			}
			if (request.method === 'POST' && request.path === '/v3/contacts/lists/413/contacts/remove') {
				return { status: 201, json: { processId: 9401, total: 1 } };
			}
			if (request.method === 'POST' && request.path === IMPORT_PATH) {
				return { status: 202, json: { processId: 9300 } };
			}
			throw new Error(`Unexpected Brevo request ${request.method} ${request.path}`);
		});

		const result = await runSync('overwrite', [111, 222]);

		expect(result).toEqual({ success: true, totalSent: 1, failedFilters: ['111'] });
		expect(brevo.requestsTo('POST', LIST_412_REMOVE)).toHaveLength(1);
		expect(pipedrive.fetchedFilters).toEqual([222]);

		const failedWrite = writeForJob(601)?.values;
		expect(failedWrite).toMatchObject({ status: 'failed' });
		expect(String(failedWrite?.errorMessage).length).toBeGreaterThan(0);
		expect(writeForJob(602)?.values).toMatchObject({ status: 'completed', totalAdded: 1 });
	});

	it('completes a zero-contact overwrite without an import request', async () => {
		runtime.filters = [{ id: 333, name: 'Pusty', brevoListId: 414, deletedAt: null }];
		runtime.jobIds = [603];
		pipedrive.deals.set(333, []);

		const brevo = stubBrevo((request) => {
			if (request.method === 'GET' && request.path === '/v3/contacts/lists/414/contacts') {
				return { json: { contacts: [], count: 0 } };
			}
			if (request.method === 'POST' && request.path === '/v3/contacts/lists/414/contacts/remove') {
				return { status: 201, json: { processId: 9402, total: 0 } };
			}
			throw new Error(`Unexpected Brevo request ${request.method} ${request.path}`);
		});

		const result = await runSync('overwrite', [333]);

		expect(result).toEqual({ success: true, totalSent: 0, failedFilters: [] });
		expect(brevo.requestsTo('POST', IMPORT_PATH)).toHaveLength(0);
		expect(writeForJob(603)?.values).toMatchObject({
			status: 'completed',
			totalFetched: 0,
			totalAdded: 0
		});
	});
});
