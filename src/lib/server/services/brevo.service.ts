import { BREVO_API_KEY, BREVO_FOLDER_ID } from '$env/static/private';
import { elapsedMs, logSync, sanitizeMessage, SyncFailure, type SyncLogContext } from './sync-log';

const BREVO_BASE_URL = 'https://api.brevo.com/v3';
const OBSERVED_EMPTY_REMOVAL_MESSAGE = 'Contacts already removed from list and/or does not exist';
// Brevo documents a 10 MB JSON body limit and recommends staying under ~8 MB.
const MAX_IMPORT_BODY_BYTES = 8 * 1024 * 1024;

interface BrevoFailure {
	status: number;
	code?: string;
	message?: string;
	diagnostic: string;
}

interface ListMembership {
	empty: boolean;
	count: number;
}

export interface BrevoContact {
	email: string;
	attributes?: {
		FIRSTNAME?: string;
		LASTNAME?: string;
		EXT_ID?: string;
	};
}

interface BrevoCreateListResponse {
	id: number;
}

async function brevoFetch(
	method: 'GET' | 'POST',
	path: string,
	context: SyncLogContext,
	body?: unknown
): Promise<Response> {
	const startedAt = performance.now();

	try {
		const response = await fetch(`${BREVO_BASE_URL}${path}`, {
			method,
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				'api-key': BREVO_API_KEY
			},
			body: body === undefined ? undefined : JSON.stringify(body)
		});

		logSync({
			...context,
			event: 'brevo.request',
			stage: 'brevo',
			durationMs: elapsedMs(startedAt),
			method,
			path,
			status: response.status,
			outcome: response.ok ? 'ok' : 'error'
		});

		return response;
	} catch {
		logSync({
			...context,
			level: 'error',
			event: 'brevo.request',
			stage: 'brevo',
			durationMs: elapsedMs(startedAt),
			method,
			path,
			outcome: 'network_error',
			message: 'Brevo request failed before receiving a response'
		});
		throw new SyncFailure(`Brevo request failed before receiving a response: ${method} ${path}`);
	}
}

function sanitizeBrevoDiagnostic(text: string): string {
	const withoutKey = BREVO_API_KEY ? text.replaceAll(BREVO_API_KEY, '[redacted]') : text;
	return sanitizeMessage(withoutKey);
}

async function readFailure(response: Response): Promise<BrevoFailure> {
	let text: string;
	try {
		text = await response.text();
	} catch {
		throw new SyncFailure(`Failed to read Brevo error response: ${response.status}`);
	}

	let code: string | undefined;
	let message: string | undefined;

	try {
		const body = JSON.parse(text) as { code?: unknown; message?: unknown } | null;
		if (typeof body?.code === 'string') code = body.code;
		if (typeof body?.message === 'string') message = body.message;
	} catch {
		// Non-JSON error bodies are never echoed.
	}

	return {
		status: response.status,
		code,
		message,
		diagnostic: message
			? sanitizeBrevoDiagnostic(message)
			: 'Brevo error response without a diagnostic message'
	};
}

function failureSummary(failure: BrevoFailure): string {
	return sanitizeMessage(
		[
			String(failure.status),
			failure.code ? sanitizeBrevoDiagnostic(failure.code) : undefined,
			failure.diagnostic
		]
			.filter(Boolean)
			.join(' - ')
	);
}

async function readJson(response: Response): Promise<unknown> {
	let text: string;
	try {
		text = await response.text();
	} catch {
		throw new SyncFailure(`Failed to read Brevo response body: ${response.status}`);
	}

	if (!text) return undefined;

	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
}

function readProcessId(payload: unknown): number | undefined {
	if (typeof payload !== 'object' || payload === null) return undefined;
	const { processId } = payload as { processId?: unknown };
	return typeof processId === 'number' && Number.isFinite(processId) ? processId : undefined;
}

function parseListMembership(payload: unknown): ListMembership | null {
	if (typeof payload !== 'object' || payload === null) return null;

	const { contacts, count } = payload as { contacts?: unknown; count?: unknown };
	if (
		!Array.isArray(contacts) ||
		typeof count !== 'number' ||
		!Number.isInteger(count) ||
		count < 0
	) {
		return null;
	}

	if (contacts.length === 0 && count === 0) {
		return { empty: true, count: 0 };
	}

	if (contacts.length > 0 && count > 0) {
		return { empty: false, count };
	}

	return null;
}

async function readListMembership(
	listId: number,
	context: SyncLogContext
): Promise<ListMembership> {
	const response = await brevoFetch('GET', `/contacts/lists/${listId}/contacts?limit=1`, context);

	if (!response.ok) {
		const failure = await readFailure(response);
		throw new SyncFailure(`Failed to check Brevo list ${listId}: ${failureSummary(failure)}`);
	}

	const membership = parseListMembership(await readJson(response));
	if (!membership) {
		throw new SyncFailure(`Failed to check Brevo list ${listId}: malformed contacts response`);
	}

	return membership;
}

function isObservedEmptyRemovalFailure(failure: BrevoFailure): boolean {
	return (
		failure.status === 400 &&
		failure.code === 'invalid_parameter' &&
		failure.message === OBSERVED_EMPTY_REMOVAL_MESSAGE
	);
}

/**
 * Create a new contact list in Brevo
 * @param name - Name of the list to create
 * @returns Object containing the new list ID
 */
export async function createList(
	name: string,
	context: SyncLogContext = {}
): Promise<{ id: number }> {
	if (!BREVO_FOLDER_ID) {
		throw new Error('BREVO_FOLDER_ID environment variable is not set');
	}

	const response = await brevoFetch('POST', '/contacts/lists', context, {
		name,
		folderId: Number(BREVO_FOLDER_ID)
	});

	if (!response.ok) {
		const failure = await readFailure(response);
		throw new SyncFailure(`Failed to create Brevo list: ${failureSummary(failure)}`);
	}

	const result: BrevoCreateListResponse = await response.json().catch(() => {
		throw new SyncFailure(`Failed to parse Brevo list creation response: ${response.status}`);
	});
	return { id: result.id };
}

/**
 * Empty an existing Brevo contact list by removing all contacts.
 * A confirmed-empty list skips removal; the observed empty-removal 400 is
 * rechecked once so a genuine failure is never silently suppressed.
 * @param listId - ID of the list to empty
 */
export async function emptyList(listId: number, context: SyncLogContext = {}): Promise<void> {
	const listContext = { ...context, brevoListId: listId };
	const preflightStartedAt = performance.now();
	const membership = await readListMembership(listId, listContext);

	logSync({
		...listContext,
		event: 'brevo.clear',
		stage: 'brevo',
		durationMs: elapsedMs(preflightStartedAt),
		decision: membership.empty ? 'skip_removal' : 'remove_all',
		listCount: membership.count
	});

	if (membership.empty) {
		return;
	}

	const removalStartedAt = performance.now();
	const response = await brevoFetch(
		'POST',
		`/contacts/lists/${listId}/contacts/remove`,
		listContext,
		{ all: true }
	);

	if (response.ok) {
		logSync({
			...listContext,
			event: 'brevo.clear',
			stage: 'brevo',
			durationMs: elapsedMs(removalStartedAt),
			decision: 'removal_submitted',
			processId: readProcessId(await readJson(response))
		});
		return;
	}

	const failure = await readFailure(response);
	if (!isObservedEmptyRemovalFailure(failure)) {
		throw new SyncFailure(`Failed to empty Brevo list: ${failureSummary(failure)}`);
	}

	const recheckStartedAt = performance.now();
	const recheck = await readListMembership(listId, listContext);

	logSync({
		...listContext,
		level: recheck.empty ? 'warn' : 'error',
		event: 'brevo.clear',
		stage: 'brevo',
		durationMs: elapsedMs(recheckStartedAt),
		decision: recheck.empty ? 'recovered_empty' : 'recheck_found_contacts',
		listCount: recheck.count
	});

	if (!recheck.empty) {
		throw new SyncFailure(`Failed to empty Brevo list: ${failureSummary(failure)}`);
	}
}

/**
 * Import contacts to a Brevo list
 *
 * One import request carries the whole contact set so Brevo creates a single
 * background process per sync instead of one per 50 contacts. The request body
 * is only split when it would exceed the documented 10 MB JSON limit.
 * @param listId - ID of the list to import contacts into
 * @param contacts - Array of contacts to import
 * @returns Object containing the total number of contacts submitted
 */
export async function importContacts(
	listId: number,
	contacts: BrevoContact[],
	context: SyncLogContext = {}
): Promise<{ imported: number }> {
	if (contacts.length === 0) {
		return { imported: 0 };
	}

	const listContext = { ...context, brevoListId: listId };
	const payload = contacts.map((contact) => ({
		email: contact.email,
		attributes: contact.attributes || {}
	}));

	const chunks = splitByPayloadSize(payload, MAX_IMPORT_BODY_BYTES);
	let totalImported = 0;

	for (const chunk of chunks) {
		const startedAt = performance.now();
		const response = await brevoFetch('POST', '/contacts/import', listContext, {
			jsonBody: chunk,
			listIds: [listId],
			updateExistingContacts: true,
			disableNotification: true
		});

		if (!response.ok) {
			const failure = await readFailure(response);
			throw new SyncFailure(`Failed to import contacts: ${failureSummary(failure)}`);
		}

		// Brevo processes the import asynchronously; this counts what was submitted.
		const processId = readProcessId(await readJson(response));
		totalImported += chunk.length;

		logSync({
			...listContext,
			event: 'brevo.import',
			stage: 'brevo',
			durationMs: elapsedMs(startedAt),
			contacts: chunk.length,
			chunks: chunks.length,
			submittedTotal: totalImported,
			processId,
			outcome: 'submitted'
		});
	}

	return { imported: totalImported };
}

/** Split contacts into the fewest chunks whose JSON stays under the API body limit. */
function splitByPayloadSize<T>(items: T[], maxBytes: number): T[][] {
	if (Buffer.byteLength(JSON.stringify(items)) <= maxBytes) {
		return [items];
	}

	const chunks: T[][] = [];
	let current: T[] = [];
	let currentBytes = 2;

	for (const item of items) {
		const itemBytes = Buffer.byteLength(JSON.stringify(item)) + 1;
		if (current.length > 0 && currentBytes + itemBytes > maxBytes) {
			chunks.push(current);
			current = [];
			currentBytes = 2;
		}
		current.push(item);
		currentBytes += itemBytes;
	}

	if (current.length > 0) {
		chunks.push(current);
	}

	return chunks;
}
