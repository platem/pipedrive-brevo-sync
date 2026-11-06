---
id: recover-empty-brevo-c44a
status: done
description: Overwrite syncs bypass confirmed-empty Brevo lists and safely recheck the observed removal error. Timestamped correlated logs expose sync stages and Brevo request outcomes.
created_at: 2026-11-06T15:32:27.851Z
updated_at: 2026-11-06T20:44:32.480Z
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

- **A1:** Before remove-all, GET `/contacts/lists/{id}/contacts?limit=1` confirms emptiness only from a valid response containing an empty contacts array and count zero; skip POST only then. Nonempty lists use existing removal. Failed/malformed checks abort without removal or import.
- **A2:** For removal HTTP 400 with code `invalid_parameter` and exact observed message `Contacts already removed from list and/or does not exist`, recheck membership once. Continue only on confirmed emptiness; otherwise fail. Other removal errors still fail, without retrying mutations.
- **A3:** Emit single-line JSON logs with ISO UTC timestamp, level, event, available filterId/jobId/brevoListId/mode, nonempty stage and nonnegative numeric durationMs. Cover job start/final outcome, Pipedrive fetch/contact counts, Brevo method/path/status or network failure, clear skip/recovery decisions, import batch/count and returned processId, removal processId if present. Distinguish submitted imports from verified completion; no polling claims.
- **A4:** Logs/errors omit credentials, request payloads and contact data. Keep diagnostic API code and sanitized message capped at 500 characters, not arbitrary raw response bodies; redact email addresses in external error text. A failure includes failing stage and preserves failed-job recording and subsequent-filter continuation; zero-contact and new-mode behavior remain unchanged.
- **A5:** Regression tests cover recovery decisions and action job outcomes using fake fetch/DB/Pipedrive, not logging output. Reviewer inspects logging in a fake-runtime probe outside the regression suite. Operator documentation gives grep examples and states async completion remains unverified.

## Verification

| Criteria | Who | Start | Do | Observe |
| --- | --- | --- | --- | --- |
| A1,A2 | reviewer | Fake Brevo transport in new service specs | Run service cases: empty, nonempty, specific 400 then empty/nonempty/error, unrelated 400/404, malformed preflight | Only confirmed-empty paths resolve without successful removal; no blanket suppression |
| A3,A4 | reviewer | Disposable fake-runtime probe, not regression specs | Exercise correlated action/service success and HTTP/network failure; inspect console | Timestamped stages/request outcomes, process IDs/batches; no credentials/contact records |
| A4,A5 | reviewer | Mocked DB/Pipedrive action driver in new route specs | Invoke actions.sync for empty overwrite, new mode, failed first of two filters | Expected requests/job writes; later filter still runs |
| A5 | parent | Installed dependencies | Run unit suite, check/build, targeted lint; read operator doc | Passing changed-scope checks; documented PM2 grep and remaining async limitation |

## Test obligation

- **Rule:** Only confirmed emptiness bypasses removal failure. **Example:** empty list → no POST; exact 400 followed by empty → resolve; nonempty/failed recheck or unrelated error → reject. **Guards:** fatal empty retry loop or swallowed real errors. **Interface:** emptyList via fake fetch. **Spec:** new `tests/unit/services/brevo-service.test.ts`.
- **Rule:** Recovery preserves workflow/job outcomes. **Example:** empty overwrite → import and completed write; new mode → create/import; failed first filter → failed write and second processed. **Guards:** recovery bypassing import or breaking failure isolation. **Interface:** actions.sync with mocks. **Spec:** new `tests/unit/routes/mode-page-server.test.ts`.
- **Test helper:** new `tests/unit/fake-runtime.ts`, shared fake transport. No assertions on logs, diagnostic field presence/format, or message bounds.
- **Superseded specs:** None; existing tests cover other routes only.

## Notes

- Evidence: `docs/brevo-api-reference.md` §§1–2,5. User resolved filter 177387 → list 412; live GET confirmed existence/static list and contacts=[], count=0, not historical causation.
- Remove-all and import are asynchronous. This best-effort patch logs process IDs but deliberately preserves existing job-completion semantics; do not silently expand into process orchestration.
- Use Bun/Vitest and `docs/unit-tests-guide.md`; no live mutations. No local .env/dependencies initially. Pre-existing untracked `.pi/` and `docs/brevo-api-reference.md` must not be staged/modified by workers.

## Delivery record

- Final acceptance: A1–A5 met using independent R1/R2 proof and parent-verified C3 mechanical closure; details in `review-closure.md`. All 34 functional tests, 9 closure probes, check/build and targeted lint pass. No logging regression tests. Next: commit/publish task branch.
- Original baseline: `05e5b596ea1edbe57548c20997562207f901d4c2`. Pre-existing untracked: `.pi/`, `docs/brevo-api-reference.md`.
- Tester `287721dc-1cc1-4ddb-90c9-73c27812d2a9`: T1 run `a9aca7fb-cad3-4d42-8bca-02c32d1ce679` returned initial reds; T1b `720f383e-8038-413b-8cc2-dc7e2d95a4e9` stopped safely before T1c revision.
- Operator rejected logging assertions: no logging regression tests. Runtime review proves diagnostic requirements. Existing behavioral preflight/recheck requirements retained. T1c returned run `a6f85590-be72-49ff-a727-8344813b8d3e`: 13 functional reds/9 green guards; logging assertions removed, paths gated and staged. Driver: `bunx vitest run tests/unit/services/brevo-service.test.ts tests/unit/routes/mode-page-server.test.ts`. C1 returned coder `85c02707-4775-466c-9e64-6c233d4e21ff`, run `7cdbf151-f826-43db-a9fa-9885459b113e`: only three permitted production paths, gated/staged; 34 unit tests, check/build and targeted lint pass with dummy env. R1 reviewer `803da51c-629d-4858-9615-a30caca2cbe7`, run `3b435889-425d-42e2-a854-087cf4f0438b`: changes needed; closure list in `review-closure.md`. Scratch `tmp/review-r1/` excluded from delivery. C2 returned run `c081c068-668f-4882-99e7-5beffd3c3ceb`: three production paths gated/staged, 34 unit tests and check/build/lint pass; raw error fallbacks removed. R2 run `6fb82ee5-0aa4-48ab-af02-468f906f52e6` returned one remaining response-read exception gap; all original findings/probes otherwise pass. C3 run `549da468-56d1-4813-aab1-8d426f76828b` returned; parent closed all findings. Scratch archived outside repo; see closure record.
- Roles must read AGENTS.md; tester additionally reads docs/unit-tests-guide.md. Workers do not commit or change ticket records.
