---
id: recover-empty-brevo-c44a
status: ready
description: Overwrite syncs bypass confirmed-empty Brevo lists and safely recheck the observed removal error. Timestamped correlated logs expose sync stages and Brevo request outcomes.
created_at: 2026-11-06T15:32:27.851Z
updated_at: 2026-11-06T15:36:10.142Z
---
# recover-empty-brevo-c44a · Recover empty Brevo lists and trace syncs

## Outcome

Overwrite can repopulate a confirmed-empty list without suppressing genuine failures. Operators can trace each filter/job through timestamped, privacy-conscious sync and Brevo logs.

## Workflow

- **Entry:** Existing new/overwrite sync form action.
- **Path:** Job creation → list preparation → Pipedrive fetch → Brevo import → persisted outcome.
- **Exit:** Existing job/UI contract retained; diagnostic events expose stage and request outcomes.

## Scope

- **Expected files:** `src/lib/server/services/brevo.service.ts`; `src/routes/(app)/[mode]/+page.server.ts`; new `src/lib/server/services/sync-log.ts`. Parent authors new `docs/brevo-sync-troubleshooting.md` after implementation.
- **Skeleton stubs:** None.
- **Interfaces (frozen):** Preserve existing return types, request bodies, 50-contact batching, action return and database schema. Optional context parameters may be added to Brevo functions; caller supplies filterId, jobId, mode, and known brevoListId.
- **Follow:** Existing service fetch and action early-return/per-filter error handling; AGENTS.md.

## Out of scope

- Process polling, automatic retries, concurrency-lock repair, moving Pipedrive fetch before clear, UI/schema changes, dependencies, deployment, live API mutations.

## Acceptance

- **A1:** Before remove-all, GET `/contacts/lists/{id}/contacts?limit=1` confirms emptiness only from a valid response containing an empty contacts array and count zero; skip POST only then. Nonempty lists use existing removal. Failed/malformed checks fail closed.
- **A2:** For removal HTTP 400 with code `invalid_parameter` and exact observed message `Contacts already removed from list and/or does not exist`, recheck membership once. Continue only on confirmed emptiness; otherwise fail. Other removal errors still fail, without retrying mutations.
- **A3:** Emit single-line JSON logs with ISO UTC timestamp, level, event, available filterId/jobId/brevoListId/mode, stage and duration. Cover job start/final outcome, Pipedrive fetch/contact counts, Brevo method/path/status or network failure, clear skip/recovery decisions, import batch/count and returned processId, removal processId if present. Distinguish submitted imports from verified completion; no polling claims.
- **A4:** Logs/errors omit credentials, request payloads and contact data. Keep diagnostic API code and bounded sanitized message, not arbitrary raw response bodies; redact email addresses in external error text. A failure includes failing stage and preserves failed-job recording and subsequent-filter continuation; zero-contact and new-mode behavior remain unchanged.
- **A5:** Regression checks prove the recovery decisions and correlated success/failure logs through the service and actual action with fake fetch/DB/Pipedrive. Operator documentation gives grep examples and explicitly states async completion remains unverified.

## Verification

| Criteria | Who | Start | Do | Observe |
| --- | --- | --- | --- | --- |
| A1,A2 | reviewer | Fake Brevo transport in new service specs | Run service cases: empty, nonempty, specific 400 then empty/nonempty/error, unrelated 400/404, malformed preflight | Only confirmed-empty paths resolve without successful removal; no blanket suppression |
| A3,A4 | reviewer | Fake service transport and captured console | Run create/remove/import success, HTTP/network failure, secret/contact sentinels | Correlated timestamped request outcomes, process IDs/batches; no sensitive sentinels |
| A3,A4,A5 | reviewer | Mocked DB/Pipedrive action driver in new route specs | Invoke actions.sync for empty overwrite, new mode, failed first of two filters | Expected requests/job writes, stage/outcome logs, later filter still runs |
| A5 | parent | Installed dependencies | Run unit suite, check/build, targeted lint; read operator doc | Passing changed-scope checks; documented PM2 grep and remaining async limitation |

## Test obligation

- **Rule:** Only confirmed emptiness bypasses removal failure. **Example:** empty list → no POST; exact 400 followed by empty → resolve; nonempty/failed recheck or unrelated error → reject. **Guards:** fatal empty retry loop or swallowed real errors. **Interface:** emptyList via fake fetch. **Spec:** new `tests/unit/services/brevo-service.test.ts`.
- **Rule:** Diagnostics correlate observable transport and caller outcomes without leaking contacts. **Example:** job for filter 177387/list 412 → ISO timestamp, IDs, method/status, batch/process IDs; failed first filter → failed write and second processed. **Guards:** untraceable stages, misleading completion, sensitive logging. **Interface:** Brevo functions and actions.sync with mocks. **Spec:** same service spec; new `tests/unit/routes/mode-page-server.test.ts`.
- **Superseded specs:** None; existing tests cover other routes only.

## Notes

- Evidence: `docs/brevo-api-reference.md` §§1–2,5. User resolved filter 177387 → list 412; live GET confirmed existence/static list and contacts=[], count=0, not historical causation.
- Remove-all and import are asynchronous. This best-effort patch logs process IDs but deliberately preserves existing job-completion semantics; do not silently expand into process orchestration.
- Use Bun/Vitest and `docs/unit-tests-guide.md`; no live mutations. No local .env/dependencies initially. Pre-existing untracked `.pi/` and `docs/brevo-api-reference.md` must not be staged/modified by workers.

## Delivery record

- Assignment T1: tester authors selected regression specs and fake-runtime drivers, shows red against original code. Next: gate tests, then coder C1, reviewer R1.
- Original baseline: pending preparation commit. Pre-existing untracked: `.pi/`, `docs/brevo-api-reference.md`.
- Roles must read AGENTS.md; tester additionally reads docs/unit-tests-guide.md. Workers do not commit or change ticket records.
