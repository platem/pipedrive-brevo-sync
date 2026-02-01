import { test, expect } from '@playwright/test';

const TEST_USERNAME = process.env.TEST_USER_USERNAME;
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD;

if (!TEST_USERNAME) {
	throw new Error('TEST_USER_USERNAME environment variable is not set');
}

if (!TEST_PASSWORD) {
	throw new Error('TEST_USER_PASSWORD environment variable is not set');
}

test.describe('Dashboard E2E Tests', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/login');
		await page.fill('[data-testid="username-input"]', TEST_USERNAME);
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
});
