# Database Schema Specification

## 1. Technology Stack

- **Database Engine**: SQLite 3.x
- **Driver**: `better-sqlite3`
- **ORM**: Drizzle ORM (`drizzle-orm/sqlite-core`)
- **Migration Tool**: Drizzle Kit

## 2. Schema Definition

### 2.1. `user` Table

**Description**: Minimalist identity table to support the single-tenant authentication requirement. Stores only the necessary identifier for session association.

| Field | Type | Constraints | Description                          |
| ----- | ---- | ----------- | ------------------------------------ |
| `id`  | TEXT | PRIMARY KEY | Unique user identifier (UUID/UUIDv4) |

---

### 2.2. `session` Table

**Description**: Stores session tokens for Lucia Auth, enabling persistent authentication across server restarts.

| Field        | Type                | Constraints                     | Description                        |
| ------------ | ------------------- | ------------------------------- | ---------------------------------- |
| `id`         | TEXT                | PRIMARY KEY                     | Unique session identifier          |
| `user_id`    | TEXT                | NOT NULL, REFERENCES `user(id)` | Foreign key to the associated user |
| `expires_at` | INTEGER (TIMESTAMP) | NOT NULL                        | Session expiration timestamp       |

---

### 2.3. `filters` Table

**Description**: Stores the mapping between Pipedrive filters and their corresponding Brevo lists. Acts as the source of truth for filter state.

| Field           | Type                | Constraints | Description                                                |
| --------------- | ------------------- | ----------- | ---------------------------------------------------------- |
| `id`            | INTEGER             | PRIMARY KEY | Pipedrive Filter ID (Natural Key)                          |
| `name`          | TEXT                | NOT NULL    | Display name of the filter (synced from Pipedrive)         |
| `brevo_list_id` | INTEGER             | NULLABLE    | Associated Brevo Contact List ID (populated on first sync) |
| `deleted_at`    | INTEGER (TIMESTAMP) | NULLABLE    | Soft-delete marker; NULL = active                          |

---

### 2.4. `sync_jobs` Table

**Description**: Log of all synchronization execution attempts. Used for status tracking, error logging, and metrics.

| Field           | Type                | Constraints                                          | Description                                        |
| --------------- | ------------------- | ---------------------------------------------------- | -------------------------------------------------- |
| `id`            | INTEGER             | PRIMARY KEY (AUTOINCREMENT)                          | Unique job identifier                              |
| `filter_id`     | INTEGER             | NOT NULL, REFERENCES `filters(id)` ON DELETE CASCADE | Associated filter                                  |
| `status`        | TEXT                | NOT NULL                                             | Current state: `processing`, `completed`, `failed` |
| `created_at`    | INTEGER (TIMESTAMP) | NOT NULL, DEFAULT (unixepoch())                      | Job initiation timestamp                           |
| `completed_at`  | INTEGER (TIMESTAMP) | NULLABLE                                             | Job completion/failure timestamp                   |
| `total_fetched` | INTEGER             | DEFAULT 0                                            | Number of Deals/Persons fetched from Pipedrive     |
| `total_added`   | INTEGER             | DEFAULT 0                                            | Number of contacts imported into Brevo             |
| `error_message` | TEXT                | NULLABLE                                             | Error details if the job failed                    |

## 3. Relationships

| Relationship            | Type | Description                                                           |
| ----------------------- | ---- | --------------------------------------------------------------------- |
| `user` → `session`      | 1:N  | One user can have multiple sessions (though only one active for MVP). |
| `filters` → `sync_jobs` | 1:N  | One filter can have multiple sync jobs over time.                     |

**Cascade Rules**:

- `sync_jobs.filter_id` → `filters.id`: `ON DELETE CASCADE` ensures job history is cleaned up if a filter is manually deleted.

## 4. Security & Access Strategy

**Authentication Middleware**:

- All API routes and Dashboard views are protected behind Lucia Auth.
- Application logic verifies a valid session exists before allowing any DB operation.

**Data Access Control**:

- Since this is a single-tenant application with a shared admin password, there is no multi-user data isolation requirement.
- All authenticated users have access to the full `filters` and `sync_jobs` datasets.
- `user` and `session` tables are managed solely by the auth library.

## 5. Indexes

| Table       | Index                      | Columns      | Type  | Justification                                                         |
| ----------- | -------------------------- | ------------ | ----- | --------------------------------------------------------------------- |
| `session`   | `idx_session_user_id`      | `user_id`    | INDEX | Fast lookup of sessions by user (used in auth checks).                |
| `session`   | `idx_session_expires_at`   | `expires_at` | INDEX | Efficient cleanup of expired sessions (cron/GC).                      |
| `sync_jobs` | `idx_sync_jobs_filter_id`  | `filter_id`  | INDEX | Speeds up filtering job history by filter.                            |
| `sync_jobs` | `idx_sync_jobs_status`     | `status`     | INDEX | Fast check for "processing" status (Concurrency Locking - REQ-003).   |
| `sync_jobs` | `idx_sync_jobs_created_at` | `created_at` | INDEX | Ordering jobs chronologically; enables future cleanup queries.        |
| `filters`   | `idx_filters_deleted_at`   | `deleted_at` | INDEX | Filter out soft-deleted filters efficiently during UI load (REQ-005). |

## 6. Tech-Specific Notes

### Drizzle ORM Configuration

- **Schema File**: `src/lib/server/db/schema.ts`
- **Migrations**: Stored in `drizzle/` directory
- **Migration Commands**:
  - `npm run db:generate`: Generates migration files
  - `npm run db:migrate`: Applies migrations to production
  - `npm run db:push`: Pushes schema changes (dev only, unsafe)

### SQLite Pragmas (Application Initialization)

For optimal performance and reliability, the following pragmas should be configured on connection:

```sql
PRAGMA journal_mode = WAL; -- Write-Ahead Logging for better concurrency
PRAGMA synchronous = NORMAL; -- Balance between safety and speed
PRAGMA foreign_keys = ON; -- Enforce foreign key constraints
PRAGMA case_sensitive_like = FALSE; -- Standardize LIKE behavior
```

### Rationale for Design Decisions

1. **Natural Key for Filters**: Using Pipedrive Filter ID as `filters.pk` simplifies the "Upsert or Ignore" logic in REQ-005 and eliminates the need for a surrogate ID mapping table.

2. **Soft Deletes**: `deleted_at` is preferred over a boolean `is_deleted` flag for auditing purposes (timestamp of when the discrepancy was detected).

3. **Job Status as TEXT**: While an ENUM type is common in other DBs, TEXT with application-level validation is sufficient for SQLite and allows easier status extension in the future without schema migrations.

4. **No Redis/Queue**: Following Product Boundary #4, we rely on the `sync_jobs.status` column and application-level locking to manage concurrency, avoiding the operational complexity of Redis.
