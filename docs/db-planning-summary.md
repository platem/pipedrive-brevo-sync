## Decisions

1.  **Table Naming**: Standardized on `sync_jobs` for the job tracking table.
2.  **Primary Keys**: `filters` table will use the Pipedrive Filter ID (Integer) as its Primary Key.
3.  **Soft Deletes**: `filters` will use a nullable `deleted_at` timestamp column; non-null indicates deleted.
4.  **Auth Schema**: Retain existing `session` table. Simplify `user` table to contain only `id` (removing `age`).
5.  **Foreign Keys**: `sync_jobs` will reference `filters.id` with `ON DELETE CASCADE` to clean up history if a filter is permanently removed.
6.  **Status Handling**: `sync_jobs.status` restricted to 'processing', 'completed', 'failed'.
7.  **Concurrency**: Job locking/concurrency control will be handled via Application Logic (checking for 'processing' status), not database locks.
8.  **Data Types**: Brevo List IDs are stored as Integers. Error messages are stored as TEXT.
9.  **Timestamps**: `sync_jobs` uses `created_at` for start time and `completed_at` for end time.

## Matched recommendations

1.  Use Pipedrive Filter ID as the PK for `filters` to simplify lookups and upserts.
2.  Add `filter_id` FK to `sync_jobs` to track history per filter.
3.  Use simple `sessions` table (id, user_id, expires_at) for persistence across server restarts.
4.  Use `integer` type for Brevo List IDs to match API response format.
5.  Allow indefinite job history retention for MVP (no auto-pruning).
6.  Use `onDelete: 'cascade'` to ensure database cleanliness if manual hard-deletes occur.

## Database planning summary

The database is designed as a lightweight SQLite-based system using `better-sqlite3` and `drizzle-orm`.

**Core Entities & Schema:**

- **`user`**: Minimalist identity table containing only `id` (Text) to support the single-tenant auth requirement.
- **`session`**: Standard Lucia Auth structure (`id`, `user_id`, `expires_at`) to ensure persistent sessions across server restarts.
- **`filters`**: Mirrors Pipedrive filters.
  - `id`: Integer (PK, matches Pipedrive ID).
  - `name`: Text (Not Null).
  - `brevo_list_id`: Integer (Nullable, populated on first sync).
  - `deleted_at`: Integer/Timestamp (Nullable, used for soft deletes).
- **`sync_jobs`**: Logs all synchronization attempts.
  - `id`: Integer (Auto-increment PK).
  - `filter_id`: Integer (FK to `filters.id`).
  - `status`: Text (values: 'processing', 'completed', 'failed').
  - `created_at`: Timestamp (Defaults to Now).
  - `completed_at`: Timestamp (Nullable).
  - `total_fetched` / `total_added`: Integers for metrics.
  - `error_message`: Text for failure details.

**Key Relationships & Constraints:**

- **1:N Relationship**: One `filter` can have multiple `sync_jobs`.
- **Cascade Delete**: Deleting a `filter` row permanently removes its associated `sync_jobs`.
- **Integrity**: Application logic ensures `name` updates on fetch and enforces single-threaded execution by checking `sync_jobs` status.

## Unresolved issues

None explicitly identified in the conversation.
