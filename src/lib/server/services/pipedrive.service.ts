import { PIPEDRIVE_API_KEY, PIPEDRIVE_BASE_URL } from '$env/static/private';

export interface PipedriveFilter {
	id: number;
	name: string;
	active_flag: boolean;
	type: 'deals' | 'leads' | 'org' | 'people' | 'products' | 'activity' | 'projects';
	temporary_flag: boolean | null;
	user_id: number;
	add_time: string;
	update_time: string;
	visible_to: number;
	custom_view_id: number;
}

interface PipedriveFilterResponse {
	success: boolean;
	data: PipedriveFilter[];
}

export async function getFilters(): Promise<PipedriveFilter[]> {
	const url = new URL('/v1/filters', PIPEDRIVE_BASE_URL);
	url.searchParams.set('type', 'deals');

	const response = await fetch(url.toString(), {
		method: 'GET',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			'x-api-token': PIPEDRIVE_API_KEY
		}
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch Pipedrive filters: ${response.status} ${response.statusText}`);
	}

	const result: PipedriveFilterResponse = await response.json();

	if (!result.success) {
		throw new Error('Pipedrive API returned unsuccessful response');
	}

	return result.data;
}
