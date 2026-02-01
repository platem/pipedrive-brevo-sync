import { describe, it, expect } from 'vitest';
import { load } from '../../../src/routes/(app)/+page.server';

type LoadEvent = Parameters<typeof load>[0];

describe('(app)/+page.server.ts', () => {
	describe('load', () => {
		it('redirects to /login when user is not authenticated', async () => {
			const event = {
				locals: { user: null, session: null }
			} as unknown as LoadEvent;

			await expect(load(event)).rejects.toMatchObject({
				status: 302,
				location: '/login'
			});
		});

		it('returns empty object when user is authenticated', async () => {
			const event = {
				locals: {
					user: { id: 'user-123', username: 'testuser' },
					session: { id: 'session-123', userId: 'user-123', expiresAt: new Date() }
				}
			} as unknown as LoadEvent;

			const result = await load(event);

			expect(result).toEqual({});
		});
	});
});
