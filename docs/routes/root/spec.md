# Technical Spec: `(app)/` Route

## Decisions

### Answered (from Q&A)

- **Header/Layout**: Use existing `(app)/+layout.svelte` providing minimal header with Logo (on root), Back button (on mode routes), and Logout button
- **Data Loading**: Load filters in `+page.server.ts` — fetch from Pipedrive API
- **Job Status Indicator**: Only on mode pages (/new, /overwrite) as disabled button + inline comment
- **Error Handling**: Redirect to simple error page on filter fetch failure; user should reload and contact admin if persists
- **Dashboard Content**: Minimal — just mode selection, no additional stats or counts

### Inferred (from docs/schema/patterns)

- **Auth**: Protected route via `hooks.server.ts` (per architecture: redirects unauthorized to /login)
- **Form Actions**: Logout action needed in layout (currently stubbed in handleLogout)
- **State Management**: No local state — pure navigation page using `goto()`

---

## Services (if applicable)

### Pipedrive Service

- **Path**: `$lib/server/services/pipedrive.ts`
- **Why**: External Adapter - Wraps Pipedrive API to centralize auth and types.
- **Methods**: `getFilters() → Promise<PipedriveFilter[]>`

---

## Data Contract

### URL Params

None

### Server Load

| Field     | Type                                                   | Source        | Empty/Error Behavior                      |
| --------- | ------------------------------------------------------ | ------------- | ----------------------------------------- |
| `filters` | `Array<Pick<Filter, 'id' \| 'name' \| 'brevoListId'>>` | Pipedrive API | Redirect to `/error?message=fetch-failed` |

### From Layout

None (layout is presentational only)

### Actions

| Action       | Input  | Success              | Failure                |
| ------------ | ------ | -------------------- | ---------------------- |
| **?/logout** | `void` | Redirect to `/login` | Inline error on button |

---

## Component Inventory

### Route: `+page.svelte` (The Orchestrator)

**Purpose**: Dashboard entry point for choosing sync operation mode

**State**: None — purely presentational

**Interactions**:

- **Click "Utwórz nowe"** → `goto('/new')`
- **Click "Nadpisz istniejące"** → `goto('/overwrite')`

---

### Inline Region: Mode Selection Card

**Visual Structure**:

- Centered container with max-width `max-w-4xl`
- Horizontal flex layout with two equal columns
- Vertical separator line between columns (`bg-border`)

**Left Column — Create New Lists**:

- Heading: "Chcę utworzyć nowe listy"
- Description: "Nowe listy w Brevo z niezsynchronizowanych filtrów Pipedrive"
- Button: "Utwórz nowe" → navigates to `/new`

**Right Column — Overwrite Existing**:

- Heading: "Chcę nadpisać istniejące listy"
- Description: "Aktualizacja list w Brevo ze zsynchronizowanych filtrów Pipedrive"
- Button: "Nadpisz istniejące" → navigates to `/overwrite`

**Empty/Error**: N/A — no dynamic data displayed

---

### Imported Component: Button (shadcn-svelte)

---

### Layout: `(app)/+layout.svelte`

**Scope**: Wraps all (app) group routes with minimal header

**State**:

- `isRootPage` (derived from `$page.url.pathname`) — determines Logo vs Back button

**Header Components**:

- **Left**: Company Logo (`/logo.svg`) on root page, Back button (with "Wstecz" label) on child routes
- **Right**: Logout button with `variant="outline" size="sm"`

**Interactions**:

- **Click Back** → `goto('/')`
- **Click Logout** → calls logout action (stubbed, needs `?/logout` form action)

---

## State Ownership

| State        | Owner                           | Trigger                     |
| ------------ | ------------------------------- | --------------------------- |
| `isRootPage` | `(app)/+layout.svelte`          | `$page.url.pathname` change |
| `filters`    | Server Load (`+page.server.ts`) | Page load / reload          |

---

## Data Flow

```
+page.server.ts
    ↓
Fetch from Pipedrive API
    ↓
Success: Pass filters to page → Available to child routes via store/context if needed
Error: throw redirect(307, '/error?message=fetch-failed')
    ↓
+page.svelte renders mode selection UI
    ↓
User clicks button → goto('/[mode]') → /new or /overwrite loads with filters
```

---

## Error Page Specification

**Route**: `/error` (to be created)

**Display**:

- Simple centered message
- Text: "Fetching filters failed. Please reload the page. Contact admin if the issue persists."
- Optional: Retry button that redirects back to `/`

## Implementation Order

1. **Pipedrive Service**
   - **Files**: `src/lib/server/services/pipedrive.service.ts`
   - **Scope**: Create service to fetch filters from Pipedrive API (using `PIPEDRIVE_API_TOKEN`). Define Pipedrive API types.
   - **Deliverable**: `getFilters()` returns list of filters from Pipedrive.

2. **Server-Side Data & Actions**
   - **Files**: `src/routes/(app)/+page.server.ts`
   - **Scope**: Implement `load` to fetch Pipedrive filters via Service. (Optional: Join with local DB if needed to populate `brevoListId`, or assumes naive fetch for now). Handle errors.
   - **Deliverable**: `load` returns filters array. Error simulation redirects to `/error`.

3. **Error Page Implementation**
   - **Files**: `src/routes/error/+page.svelte`
   - **Scope**: Create a simple error page to handle redirects from the dashboard load failure. Display the generic error message.
   - **Deliverable**: Navigating to `/error` shows "Fetching filters failed" message.

4. **Layout Logic & Logout**
   - **Files**: `src/routes/(app)/+layout.svelte`, `src/routes/(app)/+layout.server.ts` (if needed for load), `src/routes/logout/+page.server.ts` (for logout action).
   - **Scope**: Finalize `(app)/+layout.svelte`. Hook up the Logout button to a real form action (create `src/routes/logout` for it). Ensure Back button logic works (already derived).
   - **Deliverable**: Clicking Logout redirects to `/login`. Header shows Logo on `/` and Back on other routes.

5. **Dashboard Page Assembly**
   - **Files**: `src/routes/(app)/+page.svelte`
   - **Scope**: Update the existing `+page.svelte` to match the Mode Selection Card spec. Ensure it receives `data.filters` (even if not displaying them, the load triggers the fetch). Verify navigation buttons `goto('/new')` and `goto('/overwrite')`.
   - **Deliverable**: Dashboard shows two mode options. Buttons navigate correctly.
