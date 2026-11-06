# Brevo API Reference (repository usage + official documentation)

**Scope:** every Brevo endpoint this repository calls, how it calls it, what the official Brevo
documentation says about the same endpoint, and what is / is not established about the observed
production error on Pipedrive filter `177387`.

**Method and limits**

- Repository read at commit `ff241b8257793055eeaf0c04baf8b8da179383c2` (2026-02-03). All line
  references below are to that revision.
- Official documentation was located with web search (Exa) and read on **2026-11-06**. Brevo serves
  a clean Markdown version of each reference page when `.md` is appended to the URL; quotes below
  come from those pages. Links are listed in §7.
- No live Brevo or Pipedrive API call was made. No production database was read. No credentials are
  reproduced here. Credentials enter the code through `$env/static/private`
  (`src/lib/server/services/brevo.service.ts:1`).
- The repository's own earlier hand-copied excerpt (`docs/brevo.md`, 190 lines) is **not** an
  independent source; where it differs from the current official pages, §4 records the difference.

---

## 1. Endpoint map

The repository uses **three** Brevo endpoints, all in
`src/lib/server/services/brevo.service.ts`, all `POST`, all authenticated with the `api-key` header,
and all JSON. Base URL: `https://api.brevo.com/v3` (`brevo.service.ts:3`).

| #   | Method + path                                   | Repository function                            | Request body                                                                                                                                                            | Response handling                                                                                                                                                |
| --- | ----------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `POST /contacts/lists`                          | `createList(name)` (`:23-52`)                  | `{"name":<filter name>,"folderId":<Number(BREVO_FOLDER_ID)>}` (`:37-40`)                                                                                                | `!response.ok` → throw with status + raw body text (`:43-48`); otherwise parse `{id}` and return it (`:50-51`)                                                   |
| 2   | `POST /contacts/lists/{listId}/contacts/remove` | `emptyList(listId)` (`:58-79`)                 | `{"all":true}` (`:68-70`)                                                                                                                                               | `!response.ok` → throw with status + raw body text (`:73-78`); **on success the body is never read** and nothing is returned                                     |
| 3   | `POST /contacts/import`                         | `importContacts(listId, contacts)` (`:87-135`) | per batch: `{"jsonBody":[{"email","attributes":{FIRSTNAME,LASTNAME,EXT_ID}}],"listIds":[listId],"updateExistingContacts":true,"disableNotification":true}` (`:111-119`) | `!response.ok` → throw per batch (`:122-127`); on success `await response.json()` and **discard** the payload, then add `batch.length` to the count (`:129-131`) |

Notes on the map:

- Batches are 50 contacts (`BATCH_SIZE = 50`, `:95`), sent sequentially in a `for` loop (`:99-132`).
- If `contacts.length === 0`, `importContacts` returns `{imported: 0}` **without any HTTP call**
  (`:91-93`).
- There is no timeout, abort signal, retry, backoff, or `429` handling anywhere in the service
  (verified by search over `src/lib/server/services/*.ts`).
- No other Brevo endpoint is used: no `GET /contacts/lists/{id}` existence check, no
  `GET /processes/{processId}` polling, no `GET /contacts/lists/{id}/contacts` verification, no
  `notifyUrl` consumer.
- Headers on all three calls: `Accept: application/json`, `Content-Type: application/json`,
  `api-key: <BREVO_API_KEY>`.

### 1.1 Caller / workflow

Single caller: the SvelteKit form action `sync` in `src/routes/(app)/[mode]/+page.server.ts`
(route `/[mode]`, `mode ∈ {new, overwrite}`).

1. **Load** (`+page.server.ts:15-37`): validates mode, reports whether any `sync_jobs` row has
   `status = 'processing'` (`:26`).
2. **Action validation** (`:40-85`): requires filter IDs, re-checks the job lock (`:56-63`), loads
   the selected `filters` rows, and enforces mode eligibility from the DB alone
   (`:74-85`): `new` requires `brevo_list_id IS NULL`, `overwrite` requires it to be non-null.
3. **Job creation** (`:88-100`): one `sync_jobs` row per filter with `status: 'processing'`.
4. **Per-filter loop** (`:105-192`), sequential:
   - `new`: `createList(filterRecord.name)` (`:114`), then persist the returned ID to
     `filters.brevo_list_id` (`:118`).
   - `overwrite`: read `filterRecord.brevoListId` and call `emptyList(brevoListId)` (`:123-128`).
     If the stored ID is falsy, throw `Brak brevo_list_id dla filtra <id>` (`:124-126`).
   - Pipedrive: deals for the filter (`:131`), deduplicated person IDs (`:133`), batched persons
     (`:134`).
   - Contact transform (`:136-155`): skip deleted persons, take the primary email (else the first),
     skip persons without email; attributes `FIRSTNAME`, `LASTNAME`, `EXT_ID` (Pipedrive person ID).
   - Import (`:157-158`), then mark the job `completed` with `totalFetched`/`totalAdded`
     (`:160-169`).
   - Any throw aborts that filter only; the job is marked `failed` and the raw error message is
     stored in `sync_jobs.error_message` (`:174-191`). Remaining filters still run; the action
     returns `{ success: true, totalSent, failedFilters }` (`:194-198`).

Relevant schema (`src/lib/server/db/schema.ts`): `filters` (`:25-36`) holds `id` (Pipedrive filter
ID), `name`, nullable `brevo_list_id`, nullable `deleted_at`; `sync_jobs` (`:38-59`) holds
`filter_id`, `status` (`'processing' | 'completed' | 'failed'`), timestamps, `total_fetched`,
`total_added`, `error_message`. There is no `brevo_list_name`, no list-state column, and no
retry/idempotency key.

Filter rows are produced by the layout loader (`src/routes/(app)/+layout.server.ts:23-56`): Pipedrive
filters are upserted (`deletedAt` set when `active_flag` is false), and rows absent from Pipedrive are
soft-deleted. `brevo_list_id` is only ever written by the `new` branch; nothing ever clears or
re-validates it.

---

## 2. Official documentation: the three endpoints

### 2.1 `POST /contacts/lists` — Create a list

<https://developers.brevo.com/reference/create-list>

Documented request: `folderId` (long, **required**) and `name` (string, **required**).
Documented success: **201** with `{"id": <long>}`. Documented errors: **400** with a `code` from a
long enum (includes `invalid_parameter`, `missing_parameter`, `permission_denied`, …) and a readable
`message`. The page also states the endpoint creates an empty list "ready to receive contacts via the
add contacts endpoint".

Repository conformance: path, method, both required fields, and the `id` parse match. The repository
does not distinguish 201 from other 2xx (`response.ok`, `:43`), does not validate that `id` is a
number, and `folderId` is `Number(BREVO_FOLDER_ID)` (`:39`), i.e. a non-numeric env value becomes
`NaN` and would surface as a Brevo 400 rather than a local error (the guard at `:24-26` only rejects
an empty value).

### 2.2 `POST /contacts/lists/{listId}/contacts/remove` — Delete a contact from a list

<https://developers.brevo.com/reference/remove-contact-from-list>

Documented request: path parameter `listId` (long, required); body is one of `{emails:[…]}`,
`{ids:[…]}`, `{extIds:[…]}`, or `{all:true}`. The current reference page renders the body schema
opaquely (`Contacts_removeContactFromList_Request` / `any`), but the generated SDK type docs state a
cap of 150 entries per request for `emails`/`ids`/`extIds`, and the legacy readme.io rendering of
the same page states the same limit.

Documented success: **201**, described as "All contacts have been removed successfully from the list
with details of failed ones", with a `contacts` object. For the `all: true` case the documented
example response is:

```json
{ "contacts": {}, "processId": 5, "total": 23 }
```

with field docs: `processId` — "Id of the process created to remove contacts from list when user opts
for `all` option"; `total` — "total number of contacts removed from list when user opts for `all`
option". The generated SDK docs state it more explicitly: `all` = "Remove all existing contacts from
a list. **A process will be created in this scenario. You can fetch the process details to know about
the progress**" (<https://github.com/getbrevo/brevo-python/blob/main/docs/RemoveContactFromList.md>).

Documented errors: **400** (`code` enum includes `invalid_parameter`; `message` is a free-form
"Readable message associated to the failure") and **404** described as **"List ID not found"**.

Repository conformance: path, method, `api-key`, and `{"all":true}` match the documented shape. The
repository **ignores the documented asynchronous contract**: it does not read `processId`, does not
poll `GET /v3/processes/{processId}`, and does not inspect `total`. A 201 therefore only means
"removal process accepted", not "list is now empty" — a fact the calling code treats as if the list
were empty.

### 2.3 `POST /contacts/import` — Import contacts

<https://developers.brevo.com/reference/import-contacts>

Documented request fields used by the repository: `jsonBody` (list of `{email, attributes}`;
mandatory if `fileUrl`/`fileBody` absent; maximum JSON body 10 MB, with an ~8 MB recommended safe
limit), `listIds` (mandatory if `newList` not defined), `updateExistingContacts` (default `true`),
`disableNotification` (default `false`). The page notes: "Any contact attribute that doesn't exist in
your account will be ignored at import end."

Documented success: **202** with `{"processId": <long>}`; the endpoint "returns the background
process ID which on completion calls the notify URL that you have set in the input". Documented
error: **400** with the same error-code enum.

Repository conformance: request shape matches; `response.ok` accepts the documented 202; each batch's
`processId` is read and discarded (`:129-131`); `totalImported` counts _submitted_ contacts, not
imported ones; `notifyUrl` is not used, so completion and per-record failures (documented CSV reports
via process details) are never observed. Batch size 50 keeps every request far below the 10 MB body
limit.

### 2.4 Supporting endpoints the repository does **not** use but that the docs define

- `GET /v3/contacts/lists/{listId}` — <https://developers.brevo.com/reference/get-list>: **200** with
  `id`, `name`, `totalSubscribers` ("Number of contacts in the list"), `uniqueSubscribers`,
  `totalBlacklisted`, `folderId`, `createdAt`, optional `dynamicList`; **404** "List ID not found".
- `GET /v3/contacts/lists/{listId}/contacts` — <https://developers.brevo.com/reference/get-contacts-from-list>:
  **200** with `contacts[]` and `count` ("Number of contacts"), `limit` default 50 / max 500; this page
  also documents a **429** response.
- `GET /v3/processes/{processId}` — <https://developers.brevo.com/reference/get-process>: **200** with
  `id`, `name` (e.g. `IMPORTUSER`), `status` ∈ `queued | in_process | processing | completed | failed |
cancelled`; completed `IMPORTUSER` processes return CSV report URLs for invalid/duplicate records;
  **404** "Process ID not found".

These are the documented seams for verifying "is the list empty?" and "did the import finish?", and
for the async contract that `emptyList` and `importContacts` currently drop.

---

## 3. Limits and cross-cutting behavior

From <https://developers.brevo.com/docs/api-limits> (read 2026-11-06):

- Three tiers: General (all plans), Advanced (Professional/Enterprise), Extended (Enterprise). The
  tier that applies to this account is not recorded in the repository; `BREVO_API_KEY`'s plan is
  unknown here.
- General tier, "All endpoints under `/v3/contacts/{…}`": **36,000 RPH / 10 RPS**. Advanced:
  72,000 RPH / 20 RPS. Extended: 60 RPS. When both RPH and RPS apply, both must be respected.
- The repository's traffic per filter: either 1 create (`new`) or 1 remove-all (`overwrite`), plus
  `ceil(contacts/50)` imports, sent sequentially. Sequential calls alone do not guarantee compliance
  with per-second or per-hour limits; actual risk depends on response latency and workload.
- Exceeding a limit returns **429 Too Many Requests**; the repository has no 429 branch, so a 429
  would be thrown as a generic `Failed to …` error and stored in `sync_jobs.error_message`.
- Per-endpoint request ceilings relevant here: 150 identifiers per remove request (not used — we use
  `all`), 10 MB JSON body per import request, default 50/max 500 contacts per page on list reads.

---

## 4. Gaps and conflicts between repository and official documentation

| #   | Repository behavior                                                                                                                                                                                                                                        | Official documentation                                                                                                                        | Consequence                                                                                                                                                                                                                                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | `emptyList` treats any 2xx as "list emptied" and reads no body (`brevo.service.ts:73-79`)                                                                                                                                                                  | `all:true` creates a **background process**; response carries `processId` and `total` (remove-contact-from-list; SDK `RemoveContactFromList`) | The import in the same sync can start while removal is still running; job completion says nothing about final list contents                                                                                                                                    |
| G2  | No `GET /contacts/lists/{id}` before removing; stored `brevo_list_id` is never revalidated                                                                                                                                                                 | Unknown list → **404 "List ID not found"** (remove, get-list)                                                                                 | A deleted Brevo list would be expected to yield 404, not a 400 `invalid_parameter`. Nothing in the app detects or repairs a stale mapping                                                                                                                      |
| G3  | `importContacts` discards `processId` and marks the job `completed` immediately (`+page.server.ts:160-169`)                                                                                                                                                | Import returns **202 + processId**; results, including invalid/duplicate rows, are only available via process details/`notifyUrl`             | `total_added` = submitted count, not imported count; a Brevo-side failure after 202 is invisible and the list can end up empty while the job is "completed"                                                                                                    |
| G4  | Zero contacts → no import call at all (`brevo.service.ts:91-93`), job still `completed`                                                                                                                                                                    | Import requires `jsonBody`; no documented no-op semantics were needed                                                                         | A legitimately empty filter leaves the list empty after a "successful" sync                                                                                                                                                                                    |
| G5  | No retry/backoff/timeout/429 handling in `brevo.service.ts`                                                                                                                                                                                                | 429 is documented for contact endpoints; list reads document 429                                                                              | Transient rate limiting becomes a hard filter failure with a generic message                                                                                                                                                                                   |
| G6  | Error message embeds raw Brevo body: `` `Failed to empty Brevo list: ${status} ${statusText} - ${errorText}` `` (`:76`)                                                                                                                                    | Error `message` is free-form text; the `code` enum is the stable part                                                                         | Logs preserve the message but the code must be parsed out of a string; no handling by `code` anywhere                                                                                                                                                          |
| G7  | Pre-existing `docs/brevo.md` documents the remove endpoint without the 404 case and shows only the per-contact `{contacts:{success,failure}}` example                                                                                                      | Current page documents **404 "List ID not found"** and the `{contacts:{}, processId, total}` example for `all:true`                           | `docs/brevo.md` is an incomplete/older excerpt; it does not describe the async `all` response                                                                                                                                                                  |
| G8  | E2E mock `mockBrevoClearList` routes **`DELETE /contacts/lists/{listId}/contacts`** (no `/remove`) and fulfills `e2e/fixtures/brevo-clear-list.json` = `{"code":"success","message":"Contacts successfully removed from list"}` (`e2e/api-mocks.ts:36-45`) | Real call is `POST …/contacts/remove`, success 201                                                                                            | The mock does not match production; moreover `setupAllMocks` (`:72-80`) is not referenced by any test, and no unit test touches `emptyList`/`createList`/`importContacts` (searched `tests/`, `e2e/`) — the overwrite/clear path has **no automated coverage** |
| G9  | `createList` requires `BREVO_FOLDER_ID` but only checks non-empty (`:24-26`)                                                                                                                                                                               | `folderId` is required and typed long                                                                                                         | A non-numeric value becomes `NaN` and fails remotely, not locally                                                                                                                                                                                              |
| G10 | Import attributes `FIRSTNAME`, `LASTNAME`, `EXT_ID` are assumed to exist                                                                                                                                                                                   | "Any contact attribute that doesn't exist in your account will be ignored at import end"                                                      | Attribute loss is silent; no post-import verification exists                                                                                                                                                                                                   |

---

## 5. The production failure for Pipedrive filter `177387`

Observed:

```
Failed to empty Brevo list: 400 Bad Request - {"code":"invalid_parameter","message":"Contacts already removed from list and/or does not exist"}
```

### 5.1 What the repository establishes

- **It is this code path.** The string format is exactly `emptyList`'s throw template
  (`brevo.service.ts:73-78`), and the caller wraps it as `Sync failed for filter <id>` and stores the
  message in `sync_jobs.error_message` (`+page.server.ts:174-191`). `emptyList` is called only from
  the `overwrite` branch (`+page.server.ts:128`), so filter `177387` was synced in **overwrite**
  mode and had a non-null `brevo_list_id` (`:74-85`, `:123-128`).
- **The request is fixed and minimal:** `POST https://api.brevo.com/v3/contacts/lists/<stored id>/contacts/remove`,
  body `{"all":true}`, plus the three headers. No other parameters could have caused the 400
  (nothing else is sent).
- **The failure happened before deal fetch and import** for that filter (`:128` precedes `:131` and
  `:157`), so this run did not attempt to repopulate the list and the job is marked `failed`.
  The error response alone does not establish whether Brevo performed any removal or whether prior
  background processes changed the list.
- **A stale `brevo_list_id` is never detected or repaired.** The ID is written once, on first `new`
  sync (`:114-118`), persisted (`:118`), and only ever read afterwards. Nothing queries Brevo for
  list existence or count.
- **An empty list is a reachable steady state in this system.** Two code paths produce one and still
  report success: zero contacts → no import call (`brevo.service.ts:91-93`); non-zero contacts →
  202 accepted and job marked `completed` without checking the async result (`+page.server.ts:157-169`,
  §G3). Multi-filter runs are sequential within one request, but each filter has its own list.
- **The job lock is not atomic.** `SELECT … status='processing'` (`:57`) and the `INSERT` of new
  jobs (`:88-100`) are separate statements with no transaction or unique constraint on
  `(filter_id, status)`. Two overlapping submissions (double click, second tab, retry) can both pass
  the check. A `failed` job does not block later submissions at all.
- **Async Brevo work is never awaited.** Neither the remove-all process nor any import process is
  tracked, so a second overwrite run can arrive while a previous removal or import is still being
  processed by Brevo.

### 5.2 What the official documentation establishes

- `400` with `code: invalid_parameter` is a **documented, generic** 400 for this endpoint. The enum
  lists `invalid_parameter` among many causes (`not_acceptable`, `unprocessable_entity`,
  `permission_denied`, `account_under_validation`, …), and `message` is explicitly just a "Readable
  message associated to the failure". **The exact string in the log is not documented anywhere we
  could find.**
- `{ "all": true }` is the documented way to empty a list, and it is **asynchronous**: the documented
  response is 201 with `processId` and `total`, and the SDK type doc says a process is created that
  must be polled for progress.
- An unknown list has a **documented dedicated response: 404 "List ID not found"** — not 400
  `invalid_parameter`.
- **No official page states what happens when `all: true` targets a list that is already empty.**
  Searches of the reference pages, the generated SDK model docs, Brevo's community forum, and GitHub
  issues found no primary statement about that case, and no occurrence of the exact message
  "Contacts already removed from list and/or does not exist".
- The closest documented/semi-documented analogue is on the **add** endpoint family: a 2018 GitHub
  issue quotes `{"code":"invalid_parameter","message":"Contact already in list and/or does not exist"}`
  for `POST /contacts/lists/{id}/contacts/add` (<https://github.com/sendinblue/APIv3-php-library/issues/47>),
  and a third-party error catalogue lists the same wording. This suggests Brevo uses the pattern
  "<state> and/or does not exist" for membership operations, but it is **secondary evidence about a
  different endpoint**, not documentation of the remove-all case.

### 5.3 Hypotheses (not established)

`Inference:` labels below mark deductions; none of these is confirmed.

- **H1 — the list was already empty when remove-all was called.** Best fit with the wording
  "already removed", and consistent with the repo's ability to leave an empty list behind a
  `completed` job (§5.1). Its weak point is the missing premise: no source says Brevo rejects
  `{"all":true}` on an empty list. `Inference:` if H1 is true, the failure is harmless-but-fatal in
  this code (the sync aborts instead of proceeding to import), and the visible defect is the
  abort-on-400, not list corruption.
- **H2 — the stored `brevo_list_id` no longer exists in Brevo** (list deleted/merged in the Brevo UI).
  Supported only by the message fragment "does not exist"; **contradicted** by the documented 404 for
  an unknown list ID and by the observed status 400. `Unverified:` whether Brevo's remove endpoint
  ever returns 400 for an unknown list. The repo offers no way to distinguish this today.
- **H3 — concurrency / async overlap.** Either two remove-all calls for the same list (non-atomic
  lock, §5.1), or a remove-all arriving while a prior removal process or a prior import process is
  still running (neither is tracked). Mechanism that would produce the message: the first call (or
  its background process) already removed the contacts, the second call then finds nothing to
  remove. `Unverified:` no duplicate-submission or timing evidence exists in the repository; the
  single log line does not show prior or concurrent requests.
- **H4 — an account/list-state cause covered by the generic 400 enum** (e.g. a dynamic list,
  permission, account under validation, a malformed stored ID such as `0`/`NaN`). `Inference:` a
  `NaN`/`0` stored ID would produce a URL-level invalid parameter rather than the "and/or does not
  exist" wording, so this is a weaker fit than H1/H3.
- **H5 — Brevo treats remove-all on an empty list as `invalid_parameter`** rather than a 201 no-op.
  This is the specific behavior H1 depends on; it is undocumented in all sources read.

### 5.4 What would decide between them (read-only diagnostics; not performed here)

1. `GET /v3/contacts/lists/{listId}` for the stored ID: **404** supports a currently missing list
   (H2); **200** with `totalSubscribers = 0` establishes current emptiness, consistent with H1/H3.
   A positive count establishes current membership only. None of these observations proves the
   list's state at the earlier failure time; correlate with timestamped activity before attributing
   the failure.
2. `GET /v3/contacts/lists/{listId}/contacts?limit=1` → documented `count` field, with the same
   current-state versus historical-state caveat.
3. Production SQLite (read-only):
   `SELECT id, filter_id, status, total_fetched, total_added, error_message, created_at, completed_at FROM sync_jobs WHERE filter_id = 177387 ORDER BY created_at;`
   and `SELECT id, name, brevo_list_id, deleted_at FROM filters WHERE id = 177387;`
   Prior `completed` jobs with `total_added = 0`, or several near-simultaneous `processing`/`failed`
   rows, would support H1/H3 respectively. This file's author did not have access to the production DB.
4. Brevo account API logs / activity for the account around the failure time: would show whether two
   remove-all calls (or a remove-all overlapping an import) were issued.
5. A controlled experiment against a disposable empty list in a non-production account (requires
   mutation; explicitly out of scope for this research).

---

## 6. Unknowns / open questions

- The stored `brevoListId` for filter `177387`, and whether that list still exists in Brevo.
- Whether the list was empty at the moment of the call, and whether prior syncs for this filter
  completed with zero imported contacts.
- The exact trigger of Brevo's `invalid_parameter` / "Contacts already removed from list and/or does
  not exist" for this endpoint — no primary source located.
- The account's rate-limit tier and whether any 429 occurred earlier in the same run (no evidence
  either way; the stored message contains only the 400 body).
- Whether Brevo's remove-all process and our subsequent import can interleave in production; the
  documentation says the removal is a background process, but no observed behavior was recorded.
- Whether `EXT_ID` and `FIRSTNAME`/`LASTNAME` exist as attributes in this Brevo account (silently
  ignored at import end if not).

---

## 7. Sources

Official Brevo documentation, read **2026-11-06** (each reference page also available as `.md` by
appending `.md` to the URL):

1. Delete a contact from a list — <https://developers.brevo.com/reference/remove-contact-from-list>
2. Import contacts — <https://developers.brevo.com/reference/import-contacts>
3. Create a list — <https://developers.brevo.com/reference/create-list>
4. Get a list's details — <https://developers.brevo.com/reference/get-list>
5. Get contacts in a list — <https://developers.brevo.com/reference/get-contacts-from-list>
6. Get process details — <https://developers.brevo.com/reference/get-process>
7. Rate limits — <https://developers.brevo.com/docs/api-limits>
8. Documentation index — <https://developers.brevo.com/llms.txt>
9. Generated SDK model docs (derived from the same OpenAPI spec, not independent):
   <https://github.com/getbrevo/brevo-python/blob/main/docs/RemoveContactFromList.md>,
   <https://github.com/getbrevo/brevo-python/blob/main/docs/ContactsApi.md>

Secondary / weaker sources used only for the message-wording analogue (§5.2):

10. GitHub issue quoting `invalid_parameter` / "Contact already in list and/or does not exist" for the
    **add** endpoint (2018, older Sendinblue API):
    <https://github.com/sendinblue/APIv3-php-library/issues/47>
11. Third-party error catalogue listing the same add-endpoint wording:
    <https://integrately.com/integrations/brevo/error>

Repository sources consulted: `src/lib/server/services/brevo.service.ts`,
`src/routes/(app)/[mode]/+page.server.ts`, `src/routes/(app)/+layout.server.ts`,
`src/lib/server/db/schema.ts`, `e2e/api-mocks.ts`, `e2e/fixtures/brevo-*.json`, `tests/`,
`docs/brevo.md`, `docs/prd.md` (REQ-006/REQ-007/REQ-008), `docs/architecture.md`,
`docs/routes/mode/spec.md`, `docs/routes/mode/progress.md`, `README.md`.
