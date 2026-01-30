# Architecture Spec for Pipedrive-Brevo Sync Bridge

## 1. Route Tree

```
src/routes/
├── (auth)/
│   └── login/
├── (app)/
│   ├── /
│   └── [mode]/
```

## 2. Route Groups

### (auth)

- **Purpose**: Public authentication flow
- **Auth**: Public
- **Entry Point**: `/login`
- **Post-Auth Destination**: `/`

### (app)

- **Purpose**: Protected application core (dashboard and sync workflows)
- **Auth**: Protected (Requires valid session)

## 3. Design Constraints

- **Component Library**: shadcn-svelte
- **Visual Requirements**: Minimal header (Logo/Back + Logout)

## 4. Auth Strategy

- **Session Management**: Single password authentication using Lucia Auth (simple session logic); sessions persist.
- **Auth State Loading**: Validated in `hooks.server.ts`; user context populated in `event.locals`.
- **Protected Route Behavior**: Redirect all unauthorized requests to `/login`.
- **Redirects**: Login success → `/`; Logout → `/login`.

## 5. Layout Strategy

- **(app) group**: Persistent minimal header containing Company Logo (on root) and Back Arrow (on mode routes) and a Logout button.
- **(auth) group**: Standalone layout (centered card), no persistent navigation.
- **Layout Reset Points**: `/login`

## 6. Navigation Structure

- **Primary Navigation**:
  - Dashboard (`/`) acts as the main hub.
  - Mode pages (`/[mode]`) are drill-down views.
- **Hierarchy**: Flat depth-1 hierarchy (Dashboard → Task). Back navigation returns to Dashboard.

## 7. Shared Data Loading

None

## 8. State & Mutation Patterns

- **Mutations**: SvelteKit Form Actions with `use:enhance` for sync operations and logout.
- **Optimistic UI**: Inline spinners on buttons during sync; no page reload; data re-fetched on completion to update lists.
- **UI State**: Multi-select checkbox state managed locally in components.
- **Sync Status**: Global "Sync in progress" indicator/lock disabled buttons if a job is active.

## 9. Per-Route Contracts

### `/login`

**Intent**: Authenticate user
**Displays**: Single password input field, "Login" button.
**Key Interactions**:

- **Submit Password**: Validates against env variable; on success redirects to `/`; on failure shows inline error "Invalid Password".

### `/`

**Intent**: Choose sync operation mode
**Displays**: Two primary options/buttons: "Sync New" and "Overwrite Existing". Company Logo.
**Key Interactions**:

- **Select Mode**: Navigates to `/[mode]` (e.g., `/new` or `/overwrite`).
- **Logout**: Ends session and redirects to `/login`.
  **Notes**: Background fetch of Pipedrive filters occurs here to ensure data readiness.

### `/[mode]`

**Intent**: Select filters and execute sync job
**Displays**: List of eligible filters (Unsynced for 'new', Synced for 'overwrite'). Global Job Status indicator. Filter Name and ID.
**Key Interactions**:

- **Toggle Filter Selection**: Selects/deselects filters for processing (multi-select supported).
- **Run Sync**: Initiates sync job for selected filters; shows inline spinner; updates job status; on completion stays on page and refreshes data.
- **Navigate Back**: Returns to `/`.
- **Logout**: Ends session and redirects to `/login`.
  **Notes**:
- Validates `mode` param (must be `new` or `overwrite`); redirects invalid to `/`.
- Filter eligibility: `new` = `brevo_list_id` is NULL; `overwrite` = `brevo_list_id` is NOT NULL.
- "Sync" and "Overwrite" buttons disabled if global job lock is active.
