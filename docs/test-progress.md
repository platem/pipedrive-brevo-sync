# Test Progress Log

## Completed Steps

- [x] **Test Infrastructure**: Installed `jsdom` dependency for Vitest DOM testing environment. Configured `vite.config.ts` with jsdom environment and test paths including `tests/unit/**` directory.

- [x] **Test Utilities**: Created `tests/unit/test-utils.ts` with helper functions for creating mock SvelteKit events, FormData, users, and sessions. Provides `createMockEvent()`, `createMockFormData()`, `createMockUser()`, and `createMockSession()` utilities.

- [x] **Protected Route Tests (AUTH-01)**: Created `tests/unit/routes/app-page-server.test.ts` with tests for the `(app)/+page.server.ts` load function. Verifies redirect to `/login` when `locals.user` is null, and returns empty object when authenticated. **Key insight**: Load functions return Promises, use `expect(load(event)).rejects.toMatchObject()` for redirect assertions.

- [x] **Login Validation Tests (AUTH-02, AUTH-03)**: Created `tests/unit/routes/login-page-server.test.ts` with 10 tests covering:
  - `load` function: empty object for unauthenticated, redirect to `/` for authenticated users
  - `validateUsername`: rejects <3 chars, >31 chars, uppercase letters, special characters
  - `validatePassword`: rejects <6 chars, >255 chars
  - Input validation: returns 400 with appropriate error messages for invalid formats

- [x] **Test Execution**: All 12 auth-related unit tests passing (`bun run test:unit`).

- [x] **E2E Test User Setup**: Documented E2E test user strategy in test-plan.md including credentials, global setup/teardown, and safety guarantees.

- [x] **E2E Authentication Tests (AUTH-02, AUTH-03, AUTH-04)**: Created `e2e/auth.spec.ts` with 3 end-to-end tests using Playwright:
  - AUTH-02: Login with valid credentials redirects to dashboard
  - AUTH-03: Login with invalid password shows error message
  - AUTH-04: Logout clears session and redirects to login
  - Added `data-testid` attributes to login page and logout button for reliable test selectors
  - All 3 tests passing (`bun run test:e2e`)

- [x] **E2E Dashboard Navigation Tests (DASH-01, DASH-02)**: Created `e2e/dashboard.spec.ts` with 2 tests for mode selection buttons:
  - DASH-01: Click "Utwórz nowe" button navigates to `/new`
  - DASH-02: Click "Nadpisz istniejące" button navigates to `/overwrite`
  - Added `data-testid="create-new-button"` and `data-testid="overwrite-button"` to dashboard buttons
  - Both tests passing (`bun run test:e2e`)

- [x] **E2E Filter Selection Tests (DASH-03, DASH-04)**: Extended `e2e/dashboard.spec.ts` with 2 checkbox interaction tests:
  - DASH-03: Navigate to `/new`, select filters 1 and 3, verify button state updates from disabled → enabled, text shows "Utwórz nowe (1)" → "Utwórz nowe (2)"
  - DASH-04: Navigate to `/overwrite`, select filters 2 and 5, verify button state updates from disabled → enabled, text shows "Nadpisz (1)" → "Nadpisz (2)"
  - Added `data-testid="filter-checkbox-{id}"` pattern to filter checkboxes
  - Added `data-testid="sync-button"` to sync submit button
  - Both tests passing (`bun run test:e2e`)

- [x] **E2E Fixture Files**: Created `e2e/fixtures/` directory with 7 JSON fixture files:
  - `pipedrive-filters.json` (3 filters: High Value Deals, New Leads This Month, Lost Deals)
  - `pipedrive-deals.json` (2 deals with person references)
  - `pipedrive-persons.json` (2 persons matching deals)
  - `brevo-list-created.json` (list creation response with id: 98765)
  - `brevo-import.json` (import response with contacts count)
  - `brevo-clear-list.json` (success response for clearing list)
  - `pipedrive-error.json` and `brevo-error.json` (500 error responses)

- [x] **E2E Fixture Helper**: Created `e2e/fixtures/helpers.ts` with `readFixture(filename)` for loading JSON fixtures and helper functions `createJsonResponse()` and `createErrorResponse()` for crafting mock API responses.

- [x] **E2E API Mocks**: Created `e2e/api-mocks.ts` with Playwright route handlers:
  - `mockPipedriveFilters(page)`, `mockPipedriveDeals(page)`, `mockPipedrivePersons(page)`
  - `mockBrevoCreateList(page)`, `mockBrevoClearList(page, listId)`, `mockBrevoImport(page, listId)`
  - `mockPipedriveError(page, endpoint)`, `mockBrevoError(page, endpoint)`
  - `setupAllMocks(page, listId)` helper for enabling all mocks at once
