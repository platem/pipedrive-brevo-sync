# R1 closure list

Reviewer: `803da51c-629d-4858-9615-a30caca2cbe7`, run `3b435889-425d-42e2-a854-087cf4f0438b`.
Verdict: changes needed. Functional recovery and all 34 unit tests passed; A3/A4 diagnostic safety failed.

Accepted defects (owner C2, then R2 affected-scope closure review):

1. **Credentials/raw network exceptions:** `sync-log.ts:24–25`, `brevo.service.ts:75`. Error strings containing API credentials escaped sanitization; service exports rethrew raw network exceptions. Ensure logged, thrown and stored errors are safe; prefer a fixed network diagnostic over echoing arbitrary exception text. Preserve useful method/path/stage/status context and bounded sanitized diagnostic fields.
2. **Raw HTTP body fallback:** `brevo.service.ts:79–103`. Non-JSON errors or JSON without a string message became full-body diagnostics. Keep only allowed code/message fields; use a safe fallback for missing/malformed diagnostics, never response-body dumps. Recovery must still match the exact original code/message before any safe display transformation.
3. **Raw DB catches:** sync action catches at `+page.server.ts:68,76,145,220,258,269` emitted plain text/raw Error objects. Use structured contextual safe events at these boundaries rather than duplicating unsafe output before a sanitized final event. Omit arbitrary DB exception details rather than building a broad redaction framework. Preserve action return/failure recording and later-filter continuation.

No rejected findings. No product/scope expansion. Code fence remains the same three production paths.
Per operator, these diagnostic requirements are verified using disposable runtime probes, not logging regression tests; functional specs remain unchanged.

R1 scratch (not a deliverable): `tmp/review-r1/probe.test.ts`, `tmp/review-r1/vitest.config.ts`.
Reviewer could not delete these under its harness permissions. Retain for closure proof, exclude from Git, and clean up after review where allowed. No live API calls.

## R2 closure

Reviewer run `6fb82ee5-0aa4-48ab-af02-468f906f52e6`: findings 2/3 resolved and all original credential/network/DB probes passed; 34 functional tests, check/build/lint passed. Finding 1 has one remaining response-read/JSON-parse boundary gap: `response.text()` rejection or create-list `response.json()` rejection can escape raw from service exports. Action output is already safe.

Accepted C3 scope: normalize those response-read/parse failures to fixed safe service errors in `brevo.service.ts` only. Preserve failure (no suppression/retry) and all existing recovery/return semantics. This is the same untrusted-exception boundary as finding 1, not permission to add broader input validation or diagnostics tests. Decisive check: direct fake responses whose text/json readers throw email/credential sentinels must reject safely across create, membership/remove and import; successful create with invalid JSON must reject safely. Reuse R1/R2 evidence for unchanged behavior. Parent can close this mechanical correction on the decisive runtime probe plus current suite/checks without another broad review round.

## Final acceptance

C3 coder run `549da468-56d1-4813-aab1-8d426f76828b` changed only the three cited response-reader catches in `brevo.service.ts`. Parent inspected that 17-line correction and reran its 9-case disposable probe plus the 34-test functional suite: all passed. Parent also reran type-check (zero errors/warnings), production build, targeted ESLint/Prettier and whitespace checks on the final revision. R1/R2 independent full-ticket proof remains applicable outside this mechanically closed exception boundary. All accepted findings are closed; A1–A5 accepted. No live mutation or logging regression assertion was introduced.

Scratch was moved out of the repository to `/tmp/brevo-sync-review-evidence-20261106/{review-r1,c3-closure}` for local evidence retention, and is excluded from commits. Its original runtime commands were run before the move. The related source research artifact and operator troubleshooting guide are included in delivery; pre-existing `.pi/` remains untouched.
