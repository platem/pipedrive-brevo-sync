import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyList, importContacts } from '../../../src/lib/server/services/brevo.service';
import {
	createFakeBrevo,
	silenceConsole,
	type FakeBrevo,
	type FakeBrevoReply
} from '../fake-runtime';

const LIST_ID = 412;
const LIST_CONTACTS_PATH = `/v3/contacts/lists/${LIST_ID}/contacts`;
const LIST_REMOVE_PATH = `/v3/contacts/lists/${LIST_ID}/contacts/remove`;

const EMPTY_LIST_BODY = { contacts: [], count: 0 };
const OBSERVED_400_BODY = {
	code: 'invalid_parameter',
	message: 'Contacts already removed from list and/or does not exist'
};

let brevo: FakeBrevo;
let restoreConsole: () => void;

beforeEach(() => {
	restoreConsole = silenceConsole();
});

afterEach(() => {
	restoreConsole();
	vi.unstubAllGlobals();
});

function stubBrevo(handler: Parameters<typeof createFakeBrevo>[0]): FakeBrevo {
	brevo = createFakeBrevo(handler);
	vi.stubGlobal('fetch', brevo.fetch);
	return brevo;
}

describe('brevo.service.ts emptyList', () => {
	it('skips the removal POST when the preflight confirms an empty list', async () => {
		stubBrevo((request) => {
			if (request.method === 'GET' && request.path === LIST_CONTACTS_PATH) {
				return { json: EMPTY_LIST_BODY };
			}
			return { status: 201, json: { processId: 1 } };
		});

		await expect(emptyList(LIST_ID)).resolves.toBeUndefined();

		const preflight = brevo.requestsTo('GET', LIST_CONTACTS_PATH);
		expect(preflight).toHaveLength(1);
		expect(preflight[0].search).toBe('?limit=1');
		expect(brevo.requestsTo('POST', LIST_REMOVE_PATH)).toHaveLength(0);
	});

	it('removes all contacts when the preflight sees contacts', async () => {
		stubBrevo((request) => {
			if (request.method === 'GET' && request.path === LIST_CONTACTS_PATH) {
				return { json: { contacts: [{ email: 'member@example.com' }], count: 5 } };
			}
			if (request.method === 'POST' && request.path === LIST_REMOVE_PATH) {
				return { status: 201, json: { contacts: {}, processId: 444, total: 5 } };
			}
			throw new Error(`Unexpected Brevo request ${request.method} ${request.path}`);
		});

		await expect(emptyList(LIST_ID)).resolves.toBeUndefined();

		const removals = brevo.requestsTo('POST', LIST_REMOVE_PATH);
		expect(removals).toHaveLength(1);
		expect(removals[0].body).toEqual({ all: true });
	});

	it.each<[string, FakeBrevoReply | 'network']>([
		['an HTTP failure', { status: 500, statusText: 'Server Error', text: 'upstream failure' }],
		['a network failure', 'network'],
		['a response without contacts', { json: { count: 0 } }],
		['a response with non-array contacts', { json: { contacts: {}, count: 0 } }],
		['a response without count', { json: { contacts: [] } }],
		['a response with a non-numeric count', { json: { contacts: [], count: '0' } }],
		['a response with a negative count', { json: { contacts: [], count: -1 } }],
		['empty contacts with a positive count', { json: { contacts: [], count: 2 } }],
		[
			'a contact with a zero count',
			{ json: { contacts: [{ email: 'member@example.com' }], count: 0 } }
		]
	])('aborts without removal for %s', async (_label, preflightReply) => {
		stubBrevo((request) => {
			if (request.method === 'GET' && request.path === LIST_CONTACTS_PATH) {
				if (preflightReply === 'network') throw new TypeError('fetch failed');
				return preflightReply;
			}
			if (request.method === 'POST' && request.path === LIST_REMOVE_PATH) {
				return { status: 201, json: { processId: 445, total: 1 } };
			}
			throw new Error(`Unexpected Brevo request ${request.method} ${request.path}`);
		});

		await expect(emptyList(LIST_ID)).rejects.toThrow();
		expect(brevo.requestsTo('POST', LIST_REMOVE_PATH)).toHaveLength(0);
	});

	it('recovers when the exact observed 400 is followed by a confirmed-empty recheck', async () => {
		let preflightCount = 0;
		stubBrevo((request) => {
			if (request.method === 'GET' && request.path === LIST_CONTACTS_PATH) {
				preflightCount += 1;
				return {
					json:
						preflightCount === 1
							? { contacts: [{ email: 'member@example.com' }], count: 1 }
							: EMPTY_LIST_BODY
				};
			}
			if (request.method === 'POST' && request.path === LIST_REMOVE_PATH) {
				return { status: 400, statusText: 'Bad Request', json: OBSERVED_400_BODY };
			}
			throw new Error(`Unexpected Brevo request ${request.method} ${request.path}`);
		});

		await expect(emptyList(LIST_ID)).resolves.toBeUndefined();

		expect(brevo.requestsTo('GET', LIST_CONTACTS_PATH)).toHaveLength(2);
		expect(brevo.requestsTo('POST', LIST_REMOVE_PATH)).toHaveLength(1);
	});

	it.each([
		[
			'a recheck that still sees contacts',
			{ json: { contacts: [{ email: 'member@example.com' }], count: 1 } }
		],
		['a recheck that fails', { status: 500, text: 'upstream failure' }]
	])('rejects the observed 400 after %s', async (_label, recheckReply) => {
		let preflightCount = 0;
		stubBrevo((request) => {
			if (request.method === 'GET' && request.path === LIST_CONTACTS_PATH) {
				preflightCount += 1;
				return preflightCount === 1
					? { json: { contacts: [{ email: 'member@example.com' }], count: 1 } }
					: recheckReply;
			}
			if (request.method === 'POST' && request.path === LIST_REMOVE_PATH) {
				return { status: 400, statusText: 'Bad Request', json: OBSERVED_400_BODY };
			}
			throw new Error(`Unexpected Brevo request ${request.method} ${request.path}`);
		});

		await expect(emptyList(LIST_ID)).rejects.toThrow();
		expect(brevo.requestsTo('POST', LIST_REMOVE_PATH)).toHaveLength(1);
	});

	it.each([
		[
			'a 404 for a missing list',
			{
				status: 404,
				statusText: 'Not Found',
				json: { code: 'document_not_found', message: 'List ID not found' }
			}
		],
		[
			'the observed message under a different code',
			{
				status: 400,
				statusText: 'Bad Request',
				json: { code: 'missing_parameter', message: OBSERVED_400_BODY.message }
			}
		]
	])('does not recover from %s', async (_label, removeReply) => {
		stubBrevo((request) => {
			if (request.method === 'GET' && request.path === LIST_CONTACTS_PATH) {
				return { json: { contacts: [{ email: 'member@example.com' }], count: 1 } };
			}
			if (request.method === 'POST' && request.path === LIST_REMOVE_PATH) {
				return removeReply;
			}
			throw new Error(`Unexpected Brevo request ${request.method} ${request.path}`);
		});

		await expect(emptyList(LIST_ID)).rejects.toThrow();
		expect(brevo.requestsTo('POST', LIST_REMOVE_PATH)).toHaveLength(1);
	});
});

describe('brevo.service.ts importContacts', () => {
	it('returns zero imports without any HTTP request for an empty contact list', async () => {
		stubBrevo(() => {
			throw new Error('no Brevo request expected for zero contacts');
		});

		await expect(importContacts(LIST_ID, [])).resolves.toEqual({ imported: 0 });
		expect(brevo.requests).toHaveLength(0);
	});
});
