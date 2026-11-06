import { vi } from 'vitest';

/**
 * Fake Brevo transport. Stub it on `globalThis.fetch` and script the replies
 * from the observed request. Every request is recorded for assertions.
 */
export interface FakeBrevoRequest {
	method: string;
	url: string;
	path: string;
	search: string;
	body: unknown;
}

export interface FakeBrevoReply {
	status?: number;
	statusText?: string;
	json?: unknown;
	text?: string;
}

export type FakeBrevoHandler = (request: FakeBrevoRequest) => FakeBrevoReply;

export interface FakeBrevo {
	fetch: ReturnType<typeof vi.fn>;
	requests: FakeBrevoRequest[];
	requestsTo(method: string, path: string): FakeBrevoRequest[];
}

export function createFakeBrevo(handler: FakeBrevoHandler): FakeBrevo {
	const requests: FakeBrevoRequest[] = [];

	const fetchFn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
		const url =
			typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
		const parsed = new URL(url);
		const rawBody = typeof init?.body === 'string' ? init.body : undefined;

		const request: FakeBrevoRequest = {
			method: (init?.method ?? 'GET').toUpperCase(),
			url,
			path: parsed.pathname,
			search: parsed.search,
			body: rawBody === undefined ? undefined : parseJson(rawBody)
		};
		requests.push(request);

		return toResponse(handler(request));
	});

	return {
		fetch: fetchFn,
		requests,
		requestsTo: (method: string, path: string) =>
			requests.filter((request) => request.method === method.toUpperCase() && request.path === path)
	};
}

function parseJson(raw: string): unknown {
	try {
		return JSON.parse(raw);
	} catch {
		return raw;
	}
}

function toResponse(reply: FakeBrevoReply): Response {
	const status = reply.status ?? 200;
	const bodyText = reply.text ?? (reply.json === undefined ? '' : JSON.stringify(reply.json));
	return {
		ok: status >= 200 && status < 300,
		status,
		statusText: reply.statusText ?? '',
		async json() {
			return reply.json === undefined ? JSON.parse(bodyText) : reply.json;
		},
		async text() {
			return bodyText;
		}
	} as unknown as Response;
}

/** Silences console output for a test; the output is never asserted. */
export function silenceConsole(): () => void {
	const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) =>
		vi.spyOn(console, method).mockImplementation(() => {})
	);
	return () => spies.forEach((spy) => spy.mockRestore());
}
