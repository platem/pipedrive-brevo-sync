# Technical Spec: `(app)/[mode]` Route

## Decisions

### Answered (from Q&A)

- **Filter Eligibility**: `new` mode shows filters where `brevo_list_id IS NULL`; `overwrite` mode shows filters where `brevo_list_id IS NOT NULL` — aligns with architecture doc
- **Post-Sync Navigation**: Stay on page with inline success message (green text below button), refresh filter list — maintains user context
- **Filter Data Source**: Fetch from local DB only — filters pre-synced from dashboard load
- **Multi-Filter Sync**: Single request processes all selected filters sequentially — simpler error handling
- **Partial Failure Handling**: Continue processing remaining filters, report which specific filters failed — maximizes successful syncs
- **Language**: All user-facing text in Polish — consistent with prototype UI
- **Success Feedback**: Simple aggregate "Zsynchronizowano X kontaktów" — user prefers concise feedback
- **Job Lock Check**: Check in load function, pass `hasActiveJob` boolean to page — pre-disable UI
- **Empty Filter List**: Show empty state message with link back to dashboard — inform user gracefully
- **Invalid Mode Handling**: Show 404 error page — strict route validation
- **API Services**: Extract to services; existing `pipedrive.service.ts`, create new `brevo.service.ts` — reuse across routes
- **Sync Orchestration**: Action orchestrates workflow by calling pipedrive + brevo services — keeps business logic visible
- **Partial Failure Message**: List which specific filters failed — actionable feedback

### Inferred (from docs/schema/patterns)

- **Mode Validation**: Must be `new` or `overwrite` — source: architecture.md section 9
- **Job Lock Mechanism**: Check `sync_jobs` table for `status = 'processing'` — source: PRD REQ-003
- **Soft Delete**: Filters with `deleted_at IS NOT NULL` should be excluded — source: schema.ts + PRD REQ-005
- **Form Enhancement**: Use `use:enhance` for progressive enhancement — source: architecture.md section 8

## Data Contract

### URL Params

- `mode` (string: `'new'` | `'overwrite'`) — Required — Validated in load, 404 if invalid

### Server Load

- `mode` (`'new' | 'overwrite'`) — from URL params — 404 if invalid
- `filters` (`Array<Pick<Filter, 'id' | 'name'>>`) — from DB query filtered by mode eligibility and `deleted_at IS NULL` — Empty array if none
- `hasActiveJob` (`boolean`) — from `sync_jobs` table where `status = 'processing'` — false if none

### From Layout

- None (layout only provides header UI, no data)

### Actions

- **?/sync**: Input (`filterIds: number[]`) → Success: `{ success: true, totalSent: number, failedFilters: string[] }` / Failure: `fail(400, { error: string })`

**Sync Action Flow:**

1. Validate `filterIds` array is non-empty
2. Check for active job (double-check lock)
3. For each filter sequentially:
   - Create `sync_job` record with `status: 'processing'`
   - If `mode === 'new'`: Create Brevo list, store `brevo_list_id`
   - If `mode === 'overwrite'`: Empty existing Brevo list
   - Fetch deals from Pipedrive (paginated)
   - Fetch persons for each deal (throttled)
   - Transform and import to Brevo (batched)
   - Update `sync_job` with `status: 'completed'` or `status: 'failed'`
4. Return aggregate result

### [Route: +page.svelte] (The Orchestrator)

- **Props**: `data` (LoadData from load function)
- **State**:
  - `selectedFilterIds` (SvelteSet<number>) — Local, user toggle
  - `isSyncing` (boolean) — Local, form submission state
  - `successMessage` (string | null) — Local, post-action feedback
  - `failedFilters` (string[]) — Local, post-action partial failure info
- **Derived**:
  - `hasSelection` — `selectedFilterIds.size > 0`
  - `title` — Based on mode ('Utwórz nowe listy' | 'Nadpisz istniejące listy')
  - `buttonText` — Based on mode + selection count
  - `isDisabled` — `isSyncing || !hasSelection || hasActiveJob`
- **Interactions**:
  - **Toggle Filter**: Click checkbox → Add/remove from `selectedFilterIds`
  - **Submit Sync**: Click button → Set `isSyncing`, submit form, on return update `successMessage`/`failedFilters`, clear selection, refresh data

### [Inline Region: Title Header]

- **Scope/Props**: `mode` from data
- **State**: None
- **Interactions**: Display only
- **Empty/Error**: N/A

### [Inline Region: Active Job Alert]

- **Scope/Props**: `hasActiveJob` from data
- **State**: None
- **Interactions**: Display only when `hasActiveJob === true`
- **Empty/Error**: Hidden when no active job

### [Inline Region: Filter Selection Card]

- **Scope/Props**: `filters`, `hasActiveJob` from data; `selectedFilterIds` from parent state
- **State**: None (selection managed by parent)
- **Interactions**:
  - **Toggle Checkbox**: Click → Parent `toggleFilter(id)` called
  - **Disabled State**: All checkboxes disabled when `hasActiveJob === true`
- **Empty/Error**: Show "Brak dostępnych filtrów" message with Button linking to `/`

### [Inline Region: Sync Action Button]

- **Scope/Props**: `isDisabled`, `isSyncing`, `buttonText` from parent derived state
- **State**: None
- **Interactions**: Click → Trigger form submit
- **Empty/Error**: N/A

### [Inline Region: Success/Error Feedback]

- **Scope/Props**: `successMessage`, `failedFilters` from parent state
- **State**: None
- **Interactions**: Display only
- **Visibility**:
  - Success: Green text "Zsynchronizowano X kontaktów"
  - Partial failure: Success text + amber text listing failed filters
  - Full failure: Red error text
- **Empty/Error**: Hidden when no message

### [Imported Component: Card, Alert, Badge, Checkbox, Button, Spinner]

- **Props**: Standard shadcn-svelte props
- **State**: Managed by component library
- **Interactions**: Standard component behavior
- **Empty/Error**: N/A

## State Ownership

| State             | Owner         | Trigger                      |
| ----------------- | ------------- | ---------------------------- |
| selectedFilterIds | +page.svelte  | User checkbox toggle         |
| isSyncing         | +page.svelte  | Form submit start/end        |
| successMessage    | +page.svelte  | Action return                |
| failedFilters     | +page.svelte  | Action return (partial fail) |
| mode              | URL           | Navigation                   |
| filters           | Server (load) | Page load / invalidation     |
| hasActiveJob      | Server (load) | Page load / invalidation     |

## Services

### Brevo Service

- **Path**: `$lib/server/services/brevo.service.ts`
- **Why**: External API adapter — centralizes Brevo API auth, types, and rate limiting
- **Methods**:
  - `createList(name: string) → Promise<{ id: number }>`
  - `emptyList(listId: number) → Promise<void>`
  - `importContacts(listId: number, contacts: BrevoContact[]) → Promise<{ imported: number }>`

### Pipedrive Service (Existing)

- **Path**: `$lib/server/services/pipedrive.service.ts`
- **Why**: External API adapter — already exists
- **Methods to add**:
  - `getDealsByFilter(filterId: number) → Promise<PipedriveDeal[]>` (paginated internally)
  - `getPerson(personId: number) → Promise<PipedrivePerson>` (throttled)

## UI Text (Polish)

| Key              | Text                                                                |
| ---------------- | ------------------------------------------------------------------- |
| title.new        | Utwórz nowe listy                                                   |
| title.overwrite  | Nadpisz istniejące listy                                            |
| button.new       | Utwórz nowe ({count})                                               |
| button.overwrite | Nadpisz ({count})                                                   |
| alert.jobActive  | Synchronizacja w toku. Wszystkie akcje są zablokowane.              |
| empty.filters    | Brak dostępnych filtrów                                             |
| empty.backLink   | Wróć do panelu                                                      |
| success.message  | Zsynchronizowano {count} kontaktów                                  |
| error.partial    | Niepowodzenie dla filtrów: {filterNames}                            |
| error.generic    | Synchronizacja nie powiodła się. Administrator został powiadomiony. |

## Validation Rules

1. **Mode param**: Must be `'new'` or `'overwrite'` — 404 otherwise
2. **filterIds**: Non-empty array of integers — `fail(400)` if empty
3. **Job lock**: No active jobs — `fail(409)` if locked
4. **Filter ownership**: All selected filters must match mode eligibility — `fail(400)` if mismatch

## Implementation Order

1. **Refactor: Move Filter Loading to Layout**
   - **Files**: `src/routes/(app)/+layout.server.ts` (new), `src/routes/(app)/+page.server.ts` (refactor)
   - **Scope**:
     - Create `+layout.server.ts` with Pipedrive sync logic (moved from `+page.server.ts`).
     - Layout returns `{ filters }` with `id`, `name`, `brevoListId`.
     - Simplify `+page.server.ts` to empty or remove (dashboard uses layout data directly).
   - **Deliverable**: Both `/` and `/new` receive `filters` from layout; Pipedrive sync runs on any `(app)` route entry.

2. **Pipedrive Service Extension**
   - **Files**: `src/lib/server/services/pipedrive.service.ts`
   - **Scope**:
     - Add `getDealsByFilter(filterId)` with internal pagination (100 per page).
     - Add `getPerson(personId)` with throttling (80 req/2s).
     - Define types: `PipedriveDeal`, `PipedrivePerson`.
   - **Deliverable**: Manual test calling `getDealsByFilter` returns paginated deals; `getPerson` returns person data.

3. **Brevo Service Creation**
   - **Files**: `src/lib/server/services/brevo.service.ts`
   - **Scope**:
     - Create service with auth header using `BREVO_API_KEY` env var.
     - Implement `createList(name)` → returns `{ id }`.
     - Implement `importContacts(listId, contacts)` with batching (50 per request).
     - Define types: `BrevoContact`.
   - **Deliverable**: Manual test creating a list and importing contacts succeeds in Brevo dashboard.

4. **Route Load: Mode Validation & Job Lock**
   - **Files**: `src/routes/(app)/[mode]/+page.server.ts`
   - **Scope**:
     - Implement `load` function.
     - Validate `mode` param (`new` | `overwrite`), return 404 if invalid.
     - Query `sync_jobs` for `status = 'processing'` to determine `hasActiveJob`.
     - Return `{ mode, hasActiveJob }` (filters come from layout).
   - **Deliverable**: `/new` loads successfully; `/invalid` returns 404; `hasActiveJob` reflects DB state.

5. **Sync Action: Validation & Job Creation**
   - **Files**: `src/routes/(app)/[mode]/+page.server.ts`
   - **Scope**:
     - Implement `?/sync` action stub.
     - Parse and validate `filterIds` from form data (non-empty array).
     - Double-check job lock (no active `sync_jobs`), return `fail(409)` if locked.
     - Validate all selected filters match mode eligibility.
     - Create `sync_job` records with `status: 'processing'`.
   - **Deliverable**: Submitting form creates `sync_job` rows in DB; validation errors return proper fail codes.

6. **Sync Action: Orchestration Logic**
   - **Files**: `src/routes/(app)/[mode]/+page.server.ts`
   - **Scope**:
     - For `new` mode: call `brevo.createList()`, store `brevo_list_id` in `filters` table.
     - For `overwrite` mode: fetch existing `brevo_list_id` from DB.
     - Fetch deals via `pipedrive.getDealsByFilter()`.
     - Fetch persons via `pipedrive.getPerson()` for each deal.
     - Transform to `BrevoContact[]` and call `brevo.importContacts()`.
     - Update `sync_job` with `status: 'completed'` or `status: 'failed'`, `errorMessage`.
     - Return `{ success, totalSent, failedFilters }`.
   - **Deliverable**: Full sync flow works end-to-end; contacts appear in Brevo; `sync_jobs` updated correctly.

7. **UI Data Integration**
   - **Files**: `src/routes/(app)/[mode]/+page.svelte`
   - **Scope**:
     - Replace mock data with `data` props (layout `filters` + page `mode`, `hasActiveJob`).
     - Filter `data.filters` by mode eligibility client-side (`brevoListId` null/not null).
     - Wire `hasActiveJob` to disable state.
     - Add empty state UI when filtered list is empty.
   - **Deliverable**: Page displays real filters; filters correctly by mode; empty state shows when no eligible filters.

8. **UI Action Feedback**
   - **Files**: `src/routes/(app)/[mode]/+page.svelte`
   - **Scope**:
     - Handle action response in `use:enhance` callback.
     - Handle errors by displaying error message (red text).
     - Display success message (green text) with `totalSent` count.
     - Display partial failure (amber text) listing `failedFilters`.
     - Clear selection and trigger data refresh on success.
   - **Deliverable**: After sync, user sees feedback message; filter list refreshes; selection clears.
