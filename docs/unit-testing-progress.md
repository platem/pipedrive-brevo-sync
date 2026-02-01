- [x] **Test Infrastructure**: Installed `jsdom` dependency for Vitest DOM testing environment. Configured `vite.config.ts` with jsdom environment and test paths including `tests/unit/**` directory.

- [x] **Test Utilities**: Created `tests/unit/test-utils.ts` with helper functions for creating mock SvelteKit events, FormData, users, and sessions. Provides `createMockEvent()`, `createMockFormData()`, `createMockUser()`, and `createMockSession()` utilities.

- [x] **Protected Route Tests (AUTH-01)**: Created `tests/unit/routes/app-page-server.test.ts` with tests for the `(app)/+page.server.ts` load function. Verifies redirect to `/login` when `locals.user` is null, and returns empty object when authenticated. **Key insight**: Load functions return Promises, use `expect(load(event)).rejects.toMatchObject()` for redirect assertions.

- [x] **Login Validation Tests (AUTH-02, AUTH-03)**: Created `tests/unit/routes/login-page-server.test.ts` with 10 tests covering:
  - `load` function: empty object for unauthenticated, redirect to `/` for authenticated users
  - `validateUsername`: rejects <3 chars, >31 chars, uppercase letters, special characters
  - `validatePassword`: rejects <6 chars, >255 chars
  - Input validation: returns 400 with appropriate error messages for invalid formats

- [x] **Test Execution**: All 12 auth-related unit tests passing (`bun run test:unit`).
