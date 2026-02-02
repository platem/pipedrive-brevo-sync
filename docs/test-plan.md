# Test Plan for Pipedrive-Brevo Sync Bridge

## 1. Introduction

This document outlines a minimal testing strategy for the Pipedrive-Brevo Sync Bridge application. The goal is to validate critical workflows quickly before connecting to production data, using E2E tests with fixtures to simulate external API responses.

**Philosophy**: Test the happy path and critical error scenarios end-to-end. Don't over-test - this is a simple internal tool, not a consumer-facing product.

## 2. Testing Scope

Focus on **critical user journeys only**:

- **Authentication**: Login flow and route protection (already completed).
- **Sync New Workflow**: Creating a new Brevo list from Pipedrive filters and importing contacts.
- **Overwrite Workflow**: Clearing an existing Brevo list and re-importing contacts.
- **Job Locking**: Preventing concurrent sync operations.
- **Error Handling**: API failures trigger proper error logging and user notifications.

**Out of Scope:**

- Unit tests for individual service functions (covered by E2E).
- Integration tests for database interactions (covered by E2E).
- Edge cases like 0 deals (unlikely in practice).
- Code coverage metrics (overkill for internal tool).
- Load testing (not applicable for single-tenant internal tool).

## 3. Test Type: E2E with Fixtures

### 3.1 E2E Testing

- **Focus**: Critical user journeys from browser through server to database.
- **Approach**: Real app runs, but external API calls (Pipedrive, Brevo, Telegram) are intercepted and replaced with fixture data.
- **Tools**: `Playwright` with built-in `page.route()` for API mocking.

### 3.2 Fixture Strategy

- **Purpose**: Simulate external API responses deterministically and quickly.
- **Location**: `e2e/fixtures/*.json` for each external API endpoint.
- **Benefits**:
  - Fast execution (no network latency).
  - Deterministic results (no flaky tests).
  - No API keys needed for Pipedrive/Brevo.
  - Easy to test error scenarios (500 errors, rate limits).

**Fixture Files:**

| File                     | Purpose                                    |
| :----------------------- | :----------------------------------------- |
| `pipedrive-filters.json` | Mock Pipedrive filters list                |
| `pipedrive-deals.json`   | Mock deals with person details (2-3 deals) |
| `brevo-create-list.json` | Mock Brevo list creation response          |
| `brevo-import.json`      | Mock Brevo import batch response           |
| `brevo-clear-list.json`  | Mock Brevo clear list response             |
| `pipedrive-error.json`   | Mock Pipedrive API error (500)             |
| `brevo-error.json`       | Mock Brevo API error (500)                 |

## 4. Test Scenarios

### 4.1 Authentication (✅ Completed)

| ID      | Scenario                               | Expected Result                       | Status  |
| :------ | :------------------------------------- | :------------------------------------ | :------ |
| AUTH-01 | Access protected route without session | Redirect to `/login`                  | ✅ Done |
| AUTH-02 | Login with valid password              | Redirect to Dashboard (`/`)           | ✅ Done |
| AUTH-03 | Login with invalid password            | Show "Invalid Password" error         | ✅ Done |
| AUTH-04 | Logout                                 | Session cleared, redirect to `/login` | ✅ Done |

### 4.2 Dashboard Navigation (✅ Completed)

| ID      | Scenario                          | Expected Result                      | Status  |
| :------ | :-------------------------------- | :----------------------------------- | :------ |
| DASH-01 | Click "Utwórz nowe" button        | Navigates to `/new`                  | ✅ Done |
| DASH-02 | Click "Nadpisz istniejące" button | Navigates to `/overwrite`            | ✅ Done |
| DASH-03 | Select filters on `/new`          | Button enables, shows selected count | ✅ Done |
| DASH-04 | Select filters on `/overwrite`    | Button enables, shows selected count | ✅ Done |

### 4.3 Sync Workflow (E2E - To Implement)

| ID      | Scenario                                     | Expected Result                                               | Priority |
| :------ | :------------------------------------------- | :------------------------------------------------------------ | :------- |
| SYNC-01 | **Sync New**: Select unsynced filter -> Sync | New Brevo list created, contacts imported, Success UI shown   | Critical |
| SYNC-02 | **Overwrite**: Select synced filter -> Sync  | Existing list cleared, contacts re-imported, Success UI shown | Critical |
| SYNC-03 | Concurrent Sync Attempt                      | UI blocks new sync if one is running                          | Critical |

### 4.4 Error Handling (E2E - To Implement)

| ID     | Scenario                        | Expected Result                                       | Priority |
| :----- | :------------------------------ | :---------------------------------------------------- | :------- |
| ERR-01 | Pipedrive API error during sync | Job marked failed, Telegram alert sent, user notified | High     |
| ERR-02 | Brevo API error during import   | User notification shown, job lock released for retry  | High     |

## 5. Test Environment

- **Local Development**: Developers run tests locally using `bun run test:e2e`.
- **CI/CD Pipeline**: E2E tests run automatically on PRs (to be configured).
- **Environment Variables**:
  - `APP_PASSWORD`: Same as production (or test-specific).
  - `TEST_DB_URL`: Temporary SQLite file for test isolation.
  - No Pipedrive/Brevo/Telegram API keys needed (all mocked).

## 6. Testing Tools & Setup

**Required (Already Installed):**

- `@playwright/test`: E2E framework.
- `vitest`: For unit tests (auth routes already completed).
- `jsdom`: DOM testing environment for Vitest.

**No additional setup required** - fixture mocking uses Playwright's built-in `page.route()`.

## 7. E2E Test User Setup

E2E tests require a dedicated test user in the database to simulate real authentication flows.

### 7.1 Test User Credentials

| Field    | Value           |
| :------- | :-------------- |
| Username | `e2e-test-user` |
| Password | `TestPass123!`  |

### 7.2 Setup & Teardown Strategy

**Global Setup (`e2e/global-setup.ts`):**

- Runs once before all E2E tests
- Creates `e2e-test-user` if not already exists
- Uses Argon2id hashing with production parameters
- Only creates user, does not create sessions

**Cleanup After Tests:**

- Delete all sessions for `e2e-test-user` after each test file
- Delete `e2e-test-user` account after all tests complete
- Uses explicit username filter to prevent accidental prod data deletion

**Safety Guarantees:**

- All cleanup queries filter by `username = 'e2e-test-user'`
- Queries will silently do nothing if user doesn't exist
- Production user is NEVER touched

## 8. Implementation Schedule

1. **Phase 1**: ✅ Auth tests (AUTH-01, AUTH-02, AUTH-03, AUTH-04) - Completed.
2. **Phase 2**: ✅ Dashboard navigation tests (DASH-01 through DASH-04) - Completed.
3. **Phase 3**: Create fixture files for Pipedrive/Brevo/Telegram responses.
4. **Phase 4**: Implement SYNC-01 (Sync New) E2E test with fixtures.
5. **Phase 5**: Implement SYNC-02 (Overwrite) E2E test with fixtures.
6. **Phase 6**: Implement SYNC-03 (Job Lock) E2E test.
7. **Phase 7**: Implement ERR-01 and ERR-02 (Error handling) E2E tests.

## 9. Acceptance Criteria

- **Pass Rate**: 100% of Critical priority tests must pass before connecting to production data.
- **Performance**: All E2E tests should complete within 2-3 minutes (fast fixtures).
- **Code Coverage**: Not applicable (E2E tests cover critical flows).

## 10. Summary

**Test Count**: 4 (Auth) + 4 (Dashboard) + 3 (Sync) + 2 (Error) = **13 total tests**

**Estimated Runtime**: 2-3 minutes (fixtures are fast)

**What Validates:**

1. ✅ Authentication and session management
2. ✅ UI navigation and user interactions
3. ✅ Pipedrive → transformation → Brevo mapping (full data flow)
4. ✅ Database state updates (filters table, sync_jobs table)
5. ✅ Job locking prevents race conditions
6. ✅ Errors are caught, logged, and user is notified

This provides confidence the sync workflow will work with production data without comprehensive test coverage.

---

_Progress log moved to [test-progress.md](./test-progress.md)_
