import type { Actions } from './$types';
import { invalidateSession, deleteSessionTokenCookie } from '$lib/server/auth';
import { redirect } from '@sveltejs/kit';

export const actions: Actions = {
	default: async (event) => {
		const sessionId = event.locals.session?.id;

		if (sessionId) {
			await invalidateSession(sessionId);
		}

		deleteSessionTokenCookie(event);
		throw redirect(302, '/login');
	}
};
