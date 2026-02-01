import { test, expect } from '@playwright/test';

const TEST_PASSWORD = process.env.TEST_USER_PASSWORD;

if (!TEST_PASSWORD) {
	throw new Error('TEST_USER_PASSWORD environment variable is not set');
}

test.describe('Dashboard E2E Tests', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/login');
		await page.fill('[data-testid="username-input"]', 'fenbro');
		await page.fill('[data-testid="password-input"]', TEST_PASSWORD);
		await page.click('[data-testid="submit-button"]');
		await expect(page).toHaveURL('/');
	});

	test('DASH-01: Click create new button navigates to /new', async ({ page }) => {
		await page.click('[data-testid="create-new-button"]');
		await expect(page).toHaveURL('/new');
	});

	test('DASH-02: Click overwrite button navigates to /overwrite', async ({ page }) => {
		await page.click('[data-testid="overwrite-button"]');
		await expect(page).toHaveURL('/overwrite');
	});

	test('DASH-03: Select multiple filters in new mode updates button state', async ({ page }) => {
		await page.goto('/new');

		const syncButton = page.locator('[data-testid="sync-button"]');
		await expect(syncButton).toBeDisabled();

		await page.check('[data-testid="filter-checkbox-1"]');
		await expect(syncButton).toHaveText('Utwórz nowe (1)');
		await expect(syncButton).toBeEnabled();

		await page.check('[data-testid="filter-checkbox-3"]');
		await expect(syncButton).toHaveText('Utwórz nowe (2)');

		await page.uncheck('[data-testid="filter-checkbox-1"]');
		await expect(syncButton).toHaveText('Utwórz nowe (1)');
	});

	test('DASH-04: Select multiple filters in overwrite mode updates button state', async ({
		page
	}) => {
		await page.goto('/overwrite');

		const syncButton = page.locator('[data-testid="sync-button"]');
		await expect(syncButton).toBeDisabled();

		await page.check('[data-testid="filter-checkbox-2"]');
		await expect(syncButton).toHaveText('Nadpisz (1)');
		await expect(syncButton).toBeEnabled();

		await page.check('[data-testid="filter-checkbox-5"]');
		await expect(syncButton).toHaveText('Nadpisz (2)');

		await page.uncheck('[data-testid="filter-checkbox-2"]');
		await expect(syncButton).toHaveText('Nadpisz (1)');
	});
});
