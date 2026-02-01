import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { syncJobs } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
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
