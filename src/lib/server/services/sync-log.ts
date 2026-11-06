export type SyncMode = 'new' | 'overwrite';

export interface SyncLogContext {
	filterId?: number | null;
	jobId?: number | null;
	brevoListId?: number;
	mode?: SyncMode;
}

export interface SyncLogEntry extends SyncLogContext {
	level?: 'info' | 'warn' | 'error';
	event: string;
	stage: string;
	durationMs: number;
	[key: string]: unknown;
}

const MAX_DIAGNOSTIC_LENGTH = 500;
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/** An error whose message is already safe to log and store. */
export class SyncFailure extends Error {}

/**
 * Keep diagnostic text bounded and free of contact addresses.
 */
export function sanitizeMessage(message: string): string {
	return message.replace(EMAIL_PATTERN, '[redacted-email]').slice(0, MAX_DIAGNOSTIC_LENGTH);
}

export function elapsedMs(startedAt: number): number {
	return Math.max(0, Math.round(performance.now() - startedAt));
}

/**
 * Emit one JSON line per sync event so operators can correlate a filter/job run.
 */
export function logSync(entry: SyncLogEntry): void {
	const { level = 'info', ...fields } = entry;
	const line = JSON.stringify({ timestamp: new Date().toISOString(), level, ...fields });

	if (level === 'error') {
		console.error(line);
		return;
	}

	console.log(line);
}
