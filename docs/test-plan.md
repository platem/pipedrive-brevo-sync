# Test Plan for Pipedrive-Brevo Sync Bridge

## 1. Introduction

This document outlines the testing strategy for the Pipedrive-Brevo Sync Bridge application. The goal is to ensure the reliability, accuracy, and performance of the synchronization process between Pipedrive deal filters and Brevo contact lists, while maintaining a seamless user experience.

## 2. Testing Scope

The testing scope encompasses the following key areas:

- **Authentication**: Login flow and route protection.
- **Pipedrive Integration**: Fetching filters, deals, and person details; handling pagination and API limits.
- **Brevo Integration**: Creating lists, clearing lists, and importing contacts in batches.
- **Synchronization Workflow**: The "Sync New" and "Overwrite Existing" logic, including job status tracking in SQLite.
- **User Interface**: Responsiveness, error feedback, and loading states.
- **Database Interactions**: Correct storage of sync job logs and filter mappings.

**Out of Scope:**

- Internal functionality of Pipedrive or Brevo APIs (we test our integration, not their platforms).
- Load testing beyond reasonable batch sizes defined in requirements.

## 3. Test Types

### 3.1 Unit Testing

- **Focus**: Individual functions in services (`pipedrive.service.ts`, `brevo.service.ts`) and utility helpers.
- **Goal**: Verify logic correctness (e.g., data transformation, batching logic) in isolation.
- **Tools**: `Vitest` (compatible with Vite/Svelte).

### 3.2 Integration Testing

- **Focus**: Interactions between SvelteKit loaders/actions, the Database, and Service layers.
- **Goal**: Ensure data flows correctly from the API (mocked) to the DB and back to the UI.
- **Tools**: `Vitest` with database mocking (or in-memory SQLite).

### 3.3 End-to-End (E2E) Testing

- **Focus**: Critical user journeys from the browser perspective.
- **Goal**: Validate the application works as a whole in a production-like environment.
- **Tools**: `Playwright`.

## 4. Test Scenarios

### 4.1 Authentication & Routing

| ID      | Scenario                               | Expected Result                       | Priority |
| :------ | :------------------------------------- | :------------------------------------ | :------- |
| AUTH-01 | Access protected route without session | Redirect to `/login`                  | High     |
| AUTH-02 | Login with valid password              | Redirect to Dashboard (`/`)           | High     |
| AUTH-03 | Login with invalid password            | Show "Invalid Password" error         | Medium   |
| AUTH-04 | Logout                                 | Session cleared, redirect to `/login` | Medium   |

### 4.2 Core Services (Unit/Integration)

| ID      | Scenario                                    | Expected Result                       | Priority |
| :------ | :------------------------------------------ | :------------------------------------ | :------- |
| SERV-01 | Fetch Pipedrive deals with pagination       | All pages fetched and combined        | High     |
| SERV-02 | Transform Pipedrive Person to Brevo Contact | Fields mapped correctly (Email, Name) | High     |
| SERV-03 | Brevo Import batching                       | Contacts split into batches of 50     | High     |
| SERV-04 | Handle Pipedrive API failure                | Service throws handled error          | Medium   |

### 4.3 Sync Workflow (E2E)

| ID      | Scenario                                     | Expected Result                                               | Priority     |
| :------ | :------------------------------------------- | :------------------------------------------------------------ | :----------- |
| SYNC-01 | **Sync New**: Select unsynced filter -> Sync | New Brevo list created, contacts imported, Success UI shown   | **Critical** |
| SYNC-02 | **Overwrite**: Select synced filter -> Sync  | Existing list cleared, contacts re-imported, Success UI shown | **Critical** |
| SYNC-03 | Concurrent Sync Attempt                      | UI blocks new sync if one is running                          | Medium       |
| SYNC-04 | Sync with 0 deals                            | Job completes with 0 imported, user notified                  | Low          |

## 5. Test Environment

- **Local Development**: Developers run tests locally using `bun run test`.
- **CI/CD Pipeline**: Tests run automatically on PRs (to be configured).
- **Environment Variables**:
  - `TEST_PIPEDRIVE_API_KEY`: Mock or Sandbox key.
  - `TEST_BREVO_API_KEY`: Mock or Sandbox key.
  - `TEST_DB_URL`: `:memory:` or temporary SQLite file.

## 6. Testing Tools & Setup Required

Since the project currently lacks the testing libraries mentioned in the documentation, the following setup is required:

- **Test Runner**: Install `vitest` for unit/integration tests.
- **E2E Framework**: Install `@playwright/test`.
- **Mocking**: Use `msw` (Mock Service Worker) for intercepting external API calls in tests.
- **Assertion Library**: Built-in Vitest/Playwright assertions.

**Recommended Installation:**

```bash
bun add -D vitest @playwright/test
```

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
- Production user (`fenbro`) is NEVER touched

### 7.3 Implementation Files

| File                     | Purpose                               |
| :----------------------- | :------------------------------------ |
| `e2e/global-setup.ts`    | Seeds test user once before E2E tests |
| `e2e/global-teardown.ts` | Cleans up test user after all tests   |
| `e2e/auth.spec.ts`       | AUTH-02, AUTH-03, AUTH-04 E2E tests   |

## 8. Testing Schedule

1.  **Immediate**: Install missing testing infrastructure (Vitest, Playwright).
2.  **Phase 1**: Implement Unit Tests for auth routes (AUTH-01, AUTH-02, AUTH-03).
3.  **Phase 2**: Implement E2E tests for authentication (AUTH-02, AUTH-03, AUTH-04).
4.  **Phase 3**: Implement Unit Tests for `brevo.service.ts` and `pipedrive.service.ts`.
5.  **Phase 4**: Implement E2E tests for Sync Workflow (SYNC-01, SYNC-02).
6.  **Phase 5**: Edge cases and error handling tests.

## 9. Acceptance Criteria

- **Code Coverage**: Aim for >80% coverage on Service files.
- **Pass Rate**: 100% of Critical and High priority tests must pass before merging.
- **Performance**: Sync jobs for small datasets (<500 contacts) should complete/fail gracefully within timeout limits.

## 10. Roles & Responsibilities

- **QA Engineer / SDET**: Setup framework, write E2E tests, review Unit tests.
- **Developer**: Write Unit tests for new features, ensure tests pass locally before pushing.

## 11. Bug Reporting

- **Tool**: GitHub Issues.
- **Format**:
  - **Title**: [Component] Short description.
  - **Steps to Reproduce**: Detailed numbered list.
  - **Expected vs Actual**: Clear distinction.
  - **Logs/Screenshots**: Attach if applicable.
  - **Severity**: Critical / High / Medium / Low.

---

_Progress log moved to [test-progress.md](./test-progress.md)_
