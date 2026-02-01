import { test, expect } from '@playwright/test';

const TEST_USERNAME = process.env.TEST_USER_USERNAME;
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD;

if (!TEST_USERNAME) {
	throw new Error('TEST_USER_USERNAME environment variable is not set');
}

if (!TEST_PASSWORD) {
	throw new Error('TEST_USER_PASSWORD environment variable is not set');
}

test.describe('Authentication E2E Tests', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/login');
	});

	test('AUTH-02: Login with valid credentials redirects to dashboard', async ({ page }) => {
		await page.fill('[data-testid="username-input"]', TEST_USERNAME);
		await page.fill('[data-testid="password-input"]', TEST_PASSWORD);
		await page.click('[data-testid="submit-button"]');

		await expect(page).toHaveURL('/');
	});

	test('AUTH-03: Login with invalid password shows error message', async ({ page }) => {
		await page.fill('[data-testid="username-input"]', TEST_USERNAME);
		await page.fill('[data-testid="password-input"]', 'wrongpassword');
		await page.click('[data-testid="submit-button"]');

		await expect(page.locator('[data-testid="error-message"]')).toHaveText(
			'Incorrect username or password'
		);
		await expect(page).toHaveURL('/login');
	});

	test('AUTH-04: Logout clears session and redirects to login', async ({ page }) => {
		await page.fill('[data-testid="username-input"]', TEST_USERNAME);
		await page.fill('[data-testid="password-input"]', TEST_PASSWORD);
		await page.click('[data-testid="submit-button"]');

		await expect(page).toHaveURL('/');

		await page.click('[data-testid="logout-button"]');

		await expect(page).toHaveURL('/login');
		await expect(page.locator('[data-testid="username-input"]')).toBeVisible();
	});
});
