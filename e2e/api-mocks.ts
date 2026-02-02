import type { Page } from '@playwright/test';
import { readFixture } from './fixtures/helpers';

export function mockPipedriveFilters(page: Page): void {
	page.route('https://api.pipedrive.com/v1/filters*', async (route) => {
		const data = readFixture('pipedrive-filters.json');
		await route.fulfill({ json: data });
	});
}

export function mockPipedriveDeals(page: Page): void {
	page.route('https://api.pipedrive.com/v1/deals*', async (route) => {
		const data = readFixture('pipedrive-deals.json');
		await route.fulfill({ json: data });
	});
}

export function mockPipedrivePersons(page: Page): void {
	page.route('https://api.pipedrive.com/v1/persons*', async (route) => {
		const data = readFixture('pipedrive-persons.json');
		await route.fulfill({ json: data });
	});
}

export function mockBrevoCreateList(page: Page): void {
	page.route('https://api.brevo.com/v3/contacts/lists', async (route) => {
		if (route.request().method() === 'POST') {
			const data = readFixture('brevo-list-created.json');
			await route.fulfill({ json: data });
		} else {
			route.continue();
		}
	});
}

export function mockBrevoClearList(page: Page, listId: number): void {
	page.route(`https://api.brevo.com/v3/contacts/lists/${listId}/contacts`, async (route) => {
		if (route.request().method() === 'DELETE') {
			const data = readFixture('brevo-clear-list.json');
			await route.fulfill({ json: data });
		} else {
			route.continue();
		}
	});
}

export function mockBrevoImport(page: Page, listId: number): void {
	page.route(`https://api.brevo.com/v3/contacts/import`, async (route) => {
		if (route.request().method() === 'POST') {
			const data = readFixture('brevo-import.json') as Record<string, unknown>;
			await route.fulfill({ json: { ...data, listId } });
		} else {
			route.continue();
		}
	});
}

export function mockPipedriveError(page: Page, endpoint: string): void {
	page.route(`https://api.pipedrive.com/v1/${endpoint}*`, async (route) => {
		const data = readFixture('pipedrive-error.json');
		await route.fulfill({ status: 500, json: data });
	});
}

export function mockBrevoError(page: Page, endpoint: string): void {
	page.route(`https://api.brevo.com/v3/${endpoint}*`, async (route) => {
		const data = readFixture('brevo-error.json');
		await route.fulfill({ status: 500, json: data });
	});
}

export function setupAllMocks(page: Page, listId = 98765): void {
	mockPipedriveFilters(page);
	mockPipedriveDeals(page);
	mockPipedrivePersons(page);
	mockBrevoCreateList(page);
	mockBrevoClearList(page, listId);
	mockBrevoImport(page, listId);
}
