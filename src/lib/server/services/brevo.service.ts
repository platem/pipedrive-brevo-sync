import { BREVO_API_KEY } from '$env/static/private';

const BREVO_BASE_URL = 'https://api.brevo.com/v3';

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

/**
 * Create a new contact list in Brevo
 * @param name - Name of the list to create
 * @returns Object containing the new list ID
 */
export async function createList(name: string): Promise<{ id: number }> {
	const url = `${BREVO_BASE_URL}/contacts/lists`;

	const response = await fetch(url, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			'api-key': BREVO_API_KEY
		},
		body: JSON.stringify({
			name
		})
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(
			`Failed to create Brevo list: ${response.status} ${response.statusText} - ${errorText}`
		);
	}

	const result: BrevoCreateListResponse = await response.json();
	return { id: result.id };
}

/**
 * Empty an existing Brevo contact list by removing all contacts
 * @param listId - ID of the list to empty
 */
export async function emptyList(listId: number): Promise<void> {
	const url = `${BREVO_BASE_URL}/contacts/lists/${listId}/contacts/remove`;

	const response = await fetch(url, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			'api-key': BREVO_API_KEY
		},
		body: JSON.stringify({
			all: true
		})
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(
			`Failed to empty Brevo list: ${response.status} ${response.statusText} - ${errorText}`
		);
	}
}

/**
 * Import contacts to a Brevo list
 * @param listId - ID of the list to import contacts into
 * @param contacts - Array of contacts to import
 * @returns Object containing the total number of contacts imported
 */
export async function importContacts(
	listId: number,
	contacts: BrevoContact[]
): Promise<{ imported: number }> {
	if (contacts.length === 0) {
		return { imported: 0 };
	}

	const BATCH_SIZE = 50;
	let totalImported = 0;

	// Process contacts in batches of 50
	for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
		const batch = contacts.slice(i, i + BATCH_SIZE);

		const url = `${BREVO_BASE_URL}/contacts/import`;

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				'api-key': BREVO_API_KEY
			},
			body: JSON.stringify({
				jsonBody: batch.map((contact) => ({
					email: contact.email,
					attributes: contact.attributes || {}
				})),
				listIds: [listId],
				updateExistingContacts: true,
				disableNotification: true
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`Failed to import contacts batch: ${response.status} ${response.statusText} - ${errorText}`
			);
		}

		// Brevo returns a processId for async processing, we count the batch as submitted
		await response.json();
		totalImported += batch.length;
	}

	return { imported: totalImported };
}
