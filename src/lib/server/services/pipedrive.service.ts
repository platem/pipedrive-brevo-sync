import { PIPEDRIVE_API_KEY, PIPEDRIVE_BASE_URL } from '$env/static/private';

export interface PipedriveDeal {
	id: number;
	title: string;
	creator_user_id: number;
	owner_id: number;
	value: number;
	person_id: number;
	org_id: number;
	stage_id: number;
	pipeline_id: number;
	currency: string;
	archive_time: string;
	add_time: string;
	update_time: string;
	stage_change_time: string;
	status: string;
	is_archived: boolean;
	is_deleted: boolean;
	probability: number;
	lost_reason: string;
	visible_to: number;
	close_time: string;
	won_time: string;
	lost_time: string;
	local_won_date: string;
	local_lost_date: string;
	local_close_date: string;
	expected_close_date: string;
	label_ids: number[];
	origin: string;
	origin_id: string | null;
	channel: number;
	channel_id: string;
	acv: number;
	arr: number;
	mrr: number;
	custom_fields: Record<string, unknown>;
}

interface PipedriveDealResponse {
	success: boolean;
	data: PipedriveDeal[];
	additional_data?: {
		next_cursor?: string;
	};
}

interface PipedrivePersonEmail {
	value: string;
	primary: boolean;
	label: string;
}

interface PipedrivePersonPhone {
	value: string;
	primary: boolean;
	label: string;
}

export interface PipedrivePerson {
	id: number;
	name: string;
	first_name: string;
	last_name: string;
	owner_id: number;
	org_id: number;
	add_time: string;
	update_time: string;
	emails: PipedrivePersonEmail[];
	phones: PipedrivePersonPhone[];
	is_deleted: boolean;
	visible_to: number;
	label_ids: number[];
	picture_id: number;
	custom_fields: Record<string, unknown>;
	notes: string;
	im: { value: string; primary: boolean; label: string }[];
	birthday: string;
	job_title: string;
	postal_address: {
		value: string;
		country: string;
		admin_area_level_1: string;
		admin_area_level_2: string;
		locality: string;
		sublocality: string;
		route: string;
		street_number: string;
		subpremise: string;
		postal_code: string;
	};
}

interface PipedrivePersonResponse {
	success: boolean;
	data: PipedrivePerson[];
	additional_data?: {
		next_cursor?: string;
	};
}

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

export async function getDealsByFilter(filterId: number): Promise<PipedriveDeal[]> {
	const deals: PipedriveDeal[] = [];
	let cursor: string | undefined;
	const limit = 100;

	while (true) {
		const url = new URL('/api/v2/deals', PIPEDRIVE_BASE_URL);
		url.searchParams.set('filter_id', filterId.toString());
		url.searchParams.set('limit', limit.toString());
		if (cursor) {
			url.searchParams.set('cursor', cursor);
		}

		const response = await fetch(url.toString(), {
			method: 'GET',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				'x-api-token': PIPEDRIVE_API_KEY
			}
		});

		if (!response.ok) {
			throw new Error(
				`Failed to fetch Pipedrive deals for filter ${filterId}: ${response.status} ${response.statusText}`
			);
		}

		const result: PipedriveDealResponse = await response.json();

		if (!result.success) {
			throw new Error('Pipedrive API returned unsuccessful response');
		}

		deals.push(...result.data);

		cursor = result.additional_data?.next_cursor;
		if (!cursor) {
			break;
		}
	}

	return deals;
}

export async function getPersons(personIds: number[]): Promise<PipedrivePerson[]> {
	if (personIds.length === 0) {
		return [];
	}

	const persons: PipedrivePerson[] = [];
	const BATCH_SIZE = 100;

	// Process in batches of 100 (Pipedrive API limit)
	for (let i = 0; i < personIds.length; i += BATCH_SIZE) {
		const batch = personIds.slice(i, i + BATCH_SIZE);
		const idsString = batch.join(',');

		const url = new URL('/api/v2/persons', PIPEDRIVE_BASE_URL);
		url.searchParams.set('ids', idsString);

		const response = await fetch(url.toString(), {
			method: 'GET',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				'x-api-token': PIPEDRIVE_API_KEY
			}
		});

		if (!response.ok) {
			throw new Error(
				`Failed to fetch Pipedrive persons batch: ${response.status} ${response.statusText}`
			);
		}

		const result: PipedrivePersonResponse = await response.json();

		if (!result.success) {
			throw new Error('Pipedrive API returned unsuccessful response');
		}

		persons.push(...result.data);
	}

	return persons;
}
