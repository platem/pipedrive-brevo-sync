# Troubleshooting Brevo syncs

## Best-effort empty-list recovery

Overwrite reads `GET /v3/contacts/lists/{listId}/contacts?limit=1` before removal. An empty
`contacts` array together with `count: 0` confirms that there is nothing to remove, so the sync
skips removal and proceeds with the existing Pipedrive fetch/import workflow. Failed or malformed
checks fail the filter; they are not treated as evidence of emptiness.

For a nonempty list, the existing remove-all request is retained. If Brevo returns HTTP 400 with
code `invalid_parameter` and the exact message `Contacts already removed from list and/or does not
exist`, the sync rechecks membership once. It continues only if that check confirms emptiness.
Other errors still fail. No mutation is automatically retried.

This is a defensive workaround, not a confirmed explanation of the original incident. Read-only
inspection found that filter `177387` maps to Brevo list `412`, and that list existed and was empty
at inspection time. This does not establish its state at the earlier failure time.

## Find a run in production logs

Sync events are single-line JSON, with an ISO UTC `timestamp`, `level`, `event`, `stage`, and
`durationMs`. Events carry `filterId`, `jobId`, `mode`, and `brevoListId` when those identifiers are
known. Filter ID is the Pipedrive filter ID; list ID is a different identifier. Job ID identifies
one filter's sync attempt. A new list ID becomes available only after Brevo creates the list.

From the VPS, search both stdout and stderr because errors are written separately:

```bash
pm2 logs pipedrive-brevo-sync --nostream --lines 2000 2>&1 \
  | grep '"filterId":177387'
```

For older history, search the PM2 files (including both output and error logs):

```bash
grep '"filterId":177387' ~/.pm2/logs/pipedrive-brevo-sync-*.log
grep '"brevoListId":412' ~/.pm2/logs/pipedrive-brevo-sync-*.log
# Replace 501 with the jobId from the relevant event:
grep '"jobId":501' ~/.pm2/logs/pipedrive-brevo-sync-*.log
```

PM2 configuration may change file paths or rotate old logs. IDs may recur across runs, so narrow by
`jobId` and UTC timestamp. These examples assume the default compact JSON output; avoid matching
filter IDs as plain numbers, which can also appear in unrelated fields.

## What to collect

- The filter/job/list IDs, mode, and UTC time window.
- The last successful stage and the failing stage, including request method/path, HTTP status,
  diagnostic API code/message, or network failure.
- The empty-list skip/recheck decision and contact counts.
- For imports: batch number, submitted count, and returned Brevo `processId`. For removal: returned
  `processId` when present.
- The corresponding `sync_jobs` row and earlier attempts for the same filter.

Logs intentionally omit API keys, request payloads, and contact records. External error messages
are bounded and email addresses are redacted. Do not add raw payload/header logging to diagnose a
failure; keep shared log excerpts free of account/customer data.

## Important remaining limitations

Removal and import can run asynchronously at Brevo. This patch records returned process IDs but
**does not poll or wait for those processes**. A successful request means submission/acceptance,
not verified completion. The existing database/UI `completed` status and `total_added` still mean
the application finished submitting the sync and counting submitted contacts; they do not prove
Brevo imported every contact. Inspect process details read-only using the logged process IDs when
investigating delayed work or import reports.

The application still clears a nonempty list before fetching Pipedrive data, and its existing
non-atomic job lock is unchanged. Async removal/import overlap and concurrent submissions remain
possible. There are no new automatic retries, timeouts, schema changes, or background workers.

See [Brevo API reference](brevo-api-reference.md) for endpoint contracts and the original investigation.
