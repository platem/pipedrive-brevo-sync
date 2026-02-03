# Product Requirements Document

## Product Overview

The Pipedrive-Brevo Sync Bridge is a lightweight, single-tenant web application designed to synchronize contact data from Pipedrive to Brevo. It replaces a complex multi-tool workflow (n8n, Airtable, Fillout) with a bespoke, reliable integration hosted on a VPS. The application enables sales staff to sync "Deals" filtered in Pipedrive into static "Contact Lists" in Brevo for email marketing campaigns. It handles two primary use cases: creating new lists from unsynced filters and overwriting existing lists with fresh data. The system emphasizes simplicity, data consistency, and clear error reporting.

## User Problem

1.  **Fragile Workflow**: The current solution relies on multiple loosely coupled tools (n8n, Airtable), making debugging difficult and failures hard to trace.
2.  **Data Inconsistency**: Users lack confidence that the number of contacts in Pipedrive matches the number in Brevo after a sync.
3.  **Manual Overhead**: The current process is slow and requires manual intervention to ensure data quality.
4.  **Limited Visibility**: Errors often go unnoticed until a campaign fails, due to a lack of proactive alerting.

## Functional Scope

### Infrastructure & Core

#### REQ-001: SQLite Database & Persistence

Initialize a SQLite database using `better-sqlite3`.

- Schema must include `filters` and `sync_jobs` tables.
- Database file must be persisted on the host filesystem (outside the build directory) to survive server restarts.
- Use PM2 for process management in production.

#### REQ-002: Authentication

Implement a single shared password mechanism using Lucia Auth (or simple session-based auth).

- Login page with a single password field.
- Compare input against the `APP_PASSWORD` environment variable.
- On success, create a session and redirect to the dashboard.
- On failure, show "Invalid Password".
- Protect all API routes and Dashboard views behind this authentication.

#### REQ-003: Job Locking Mechanism

Prevent concurrent sync operations to ensure data integrity and API rate limit compliance.

- Check for any `sync_jobs` with status `processing` before starting a new job.
- If a job is running, disable "Sync" and "Overwrite" buttons in the UI.
- Display a global "Sync in progress..." indicator if a job is active.

### Dashboard UI

#### REQ-004: Dashboard Layout

Create a main dashboard view.

- Fetch and display all available Pipedrive filters on load.
- Display a "Sync New" section for filters not yet in the `filters` database table.
- Display a "Synced / Overwrite" section for filters that exist in the `filters` table.
- Show a prominent status area for current job progress.

#### REQ-005: Filter List Display

Render the list of Pipedrive filters.

- Fetch all filters from Pipedrive.
- Cross-reference with local SQLite `filters` table. Upsert missing filters.
- If a filter is locally "synced" but no longer exists in Pipedrive, soft delete it so that it does not appear in the UI.
- Show Filter Name and ID.

### Sync Logic (New & Overwrite)

#### REQ-006: Sync Initialization (New)

Handle the flow for syncing a filter for the first time.

- User selects one or more "Unsynced" filters.
- On submit:
  1.  Create a new Contact List in Brevo with name `{Filter Name}`.
  2.  Store mapping in the db (`filter_id`, `brevo_list_id`, `filter_name`).
  3.  Initiate the Data Fetch & Import process (REQ-008).

#### REQ-007: Sync Initialization (Overwrite)

Handle the flow for updating an already synced list.

- User selects a "Synced" filter.
- On submit:
  1.  Retrieve the associated `brevo_list_id` from SQLite.
  2.  **Empty the List**: Call Brevo API to remove all contacts from this specific List ID (preserving the ID itself).
  3.  Initiate the Data Fetch & Import process (REQ-008).

#### REQ-008: Data Fetch & Import Workflow

Execute the core sync logic synchronously.

- **Step 1: Fetch Deals**: Query Pipedrive for Deals matching the `filter_id`.
  - Pagination: Fetch in pages of 100.
- **Step 2: Fetch Persons**: For each Deal, fetch the associated Person details individually.
  - Throttling: Ensure requests respect the 80 req/2s limit.
- **Step 3: Transform**: Extract Person data (Name, Email, Phone, Id).
  - Get only the 1st email a Person has.
- **Step 4: Import**: Send to Brevo.
  - Batch size: 50 contacts per request.
  - Map fields: Email, First Name, Last Name, Ext_ID (Pipedrive Person ID).
  - Target List: The `brevo_list_id` from initialization.
  - Brevo handles deduplication.
- **Step 5: Completion**: Update SQLite `sync_jobs` with `total_fetched` and `total_added` (sent). Mark status `completed`.

#### REQ-009: Success Feedback

Display the results of the operation.

- Show a success message/modal: "Sync Complete. Fetched: X, Sent to Brevo: Y".
- Refresh the filter lists (move newly synced filters to the "Synced" section).

### Error Handling & Monitoring

#### REQ-010: Error Handling

Manage failures gracefully.

- Wrap API calls in Try/Catch blocks.
- On failure:
  1.  Log the error to SQLite `sync_jobs` (status: `failed`, message: error details).
  2.  Show a user-friendly error in the UI ("Sync failed.").
  3.  Reset the "Job Lock" (REQ-010) to allow retries.

## Product Boundaries

The following are explicitly **out of scope**:

1.  **Advanced Deduplication**: We rely entirely on Brevo's import API to handle duplicate emails existing in their system.
2.  **Complex Rollback**: If a sync fails halfway (e.g., 50/100 contacts imported), we do not auto-rollback. The user must simply retry the "Overwrite" sync to fix the state.
3.  **User Management**: No admin panel to add/remove users.
4.  **Background Queues**: No Redis/BullMQ. All processing happens during the HTTP request lifecycle (with extended timeout configurations).
5.  **OAuth**: We use simple API Token authentication for Pipedrive.

## Success Metrics

1.  **Reliability**: 100% of "Completed" jobs result in a Brevo list containing the expected contacts (verified via spot checks).
2.  **Stability**: Zero database corruption events after server restarts.
