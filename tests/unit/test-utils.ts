import type { RequestEvent } from '@sveltejs/kit';
import { vi } from 'vitest';
import type { Session, User } from '$lib/server/db/schema';

export function createMockEvent(overrides: Partial<RequestEvent> = {}): RequestEvent {
	return {
		cookies: {
			get: vi.fn(),
			set: vi.fn(),
			delete: vi.fn()
		},
		request: {
			formData: vi.fn()
		} as unknown as Request,
		locals: {},
		params: {},
		platform: undefined,
		getClientAddress: () => '127.0.0.1',
		fetch: globalThis.fetch,
		...overrides
	} as unknown as RequestEvent;
}

export function createMockFormData(data: Record<string, string>): FormData {
	const formData = new FormData();
	for (const [key, value] of Object.entries(data)) {
		formData.set(key, value);
	}
	return formData;
}

export function createMockUser(overrides: Partial<User> = {}): User {
	return {
		id: 'user-123',
		username: 'testuser',
		passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$abc123$xyz789',
		...overrides
	};
}

export function createMockSession(overrides: Partial<Session> = {}): Session {
	return {
		id: 'session-123',
		userId: 'user-123',
		expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
		...overrides
	};
}
