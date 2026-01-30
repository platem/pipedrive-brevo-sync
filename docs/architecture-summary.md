## Architectural decisions

1. Use SvelteKit route groups `(auth)` and `(app)` to separate login from protected UI.
2. Use `hooks.server.ts` for session validation and redirect all unauthorized requests to `/login`.
3. Use `/login` for authentication and redirect to `/` on successful login.
4. Use `/` as the root dashboard route.
5. Use a mode route `/<mode>` via a dynamic segment (`/[mode]`) for mode-specific sync screens.
6. Validate `mode` server-side and redirect invalid values to `/`.
7. On `/`, show a split screen with two option buttons to choose the sync mode.
8. Fetch/sync Pipedrive filters immediately on `/` load (in the background) and do it on every load.
9. Use a minimal header: company logo + logout on `/`, and a minimal back arrow + logout on `/<mode>`.
10. Use form actions with inline feedback (spinner) for sync operations; do not add polling/SSE.
11. Support multi-select checkboxes with single submit for both modes (new sync and overwrite).
12. After a sync completes on `/<mode>`, stay on the page and re-fetch data.
13. Implement logout as a form action and redirect to `/login`.
14. Do not add a sync job history UI route for now.
15. Determine eligibility for mode-specific filter lists using `filters.brevo_list_id` presence (new = NULL, overwrite = NOT NULL).

## Matched recommendations

1. Separate `(auth)` and `(app)` route groups.
2. Use `hooks.server.ts` to validate sessions and populate user context for protected routes.
3. Use `/` as the dashboard root instead of `/dashboard`.
4. Use dynamic segment `/<mode>` instead of `/sync?mode=...`.
5. Add a minimal back arrow on `/<mode>` routes.
6. Redirect invalid `mode` values to `/`.
7. Fetch filters immediately on `/` rather than deferring until mode selection.
8. Stay on `/<mode>` after completion rather than redirecting back to `/`.
9. Redirect logout to `/login`.

## User Clarifications

Specific details provided by the user that refine or override recommendations:

1. "Just use a spinner on the button and return either success or failure for the action result and update state -> button accordingly. Don't overcomplicate"
2. "No need to show filer counts, this should happen in the background"
3. "Let's do multi-select, PRD's wording is off then"
4. "I don't plan on adding more routes later on. Focus only on the current task."
5. "After a sync job completes on `/[mode]`, stay on page (but re-fetch data)"
6. "All unauthorized calls go to /login"

## Unresolved issues

None identified.
