import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Auth checks will be added here
	// Filters are provided by +layout.server.ts
	return {};
};
