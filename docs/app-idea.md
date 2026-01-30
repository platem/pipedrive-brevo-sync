# Pipedrive-Brevo Sync Bridge - Requirements Summary

## Goal
Replace the existing n8n + Airtable + Fillout workflow with a lightweight SvelteKit application that syncs Pipedrive deal filters with Brevo contact lists. The app serves as a bridge between two external APIs with SQLite as the state store.

## Core Functionality

### Two Sync Operations
1. **New Filter Sync**: Create new Brevo lists from Pipedrive filters that haven't been synced yet
2. **Overwrite Existing**: Clear an existing Brevo list and repopulate it with current Pipedrive filter data

### Data Flow (per sync job)
- Accept filter selection from user (one or multiple filters)
- Create Brevo list (or target existing for overwrite)
- Fetch all deals matching the Pipedrive filter ID(s)
- For each deal: fetch Person details, extract first email
- Aggregate contacts into 50-item batches
- POST to Brevo `/v3/contacts/import` endpoint
- Track counts: Fetched vs Added (must match)
- Mark filter(s) as synced in database

### Data Consistency Requirements
- Simple count comparison: Number of fetched contacts must equal number successfully added
- No data loss between FETCHED and ADDED
- Brevo handles email deduplication automatically
- On failure: clear error state, mark job as failed, allow retry (no complex rollback)

## Technical Requirements

### Database (SQLite via better-sqlite3)
**Two tables** (minimal schema):
- `filters`: id, filter_name, filter_id (Pipedrive), is_used, created_at
- `sync_jobs`: id, filter_id, brevo_list_id, type ('new' | 'overwrite'), status, total_fetched, total_added, error_message, created_at, completed_at

### Authentication
- Single shared password for all users
- Simple password field protection
- Lucia auth already installed in project

### Error Handling & Notifications
- Telegram bot notifications for all errors
- Bot token and chat ID via environment variables
- Error details: which filter failed, what stage, error message
- UX: simple spinner while processing, result displayed on completion
- Telegram used ONLY for error alerts, not completion notifications

### Async Processing
- Server-side synchronous processing (user waits with spinner)
- No background job persistence needed
- User submits job → sees spinner → result displayed

### UI Requirements
- Display ~50 filters max (refresh on app open)
- Checkbox selection for new sync (unused filters only)
- Dropdown selection for overwrite (existing synced filters)
- Simple status display with spinner during processing
- Success message with counts (Fetched: X, Added: Y)
- Basic error display in UI

### API Integrations
- **Pipedrive**: Filter API, Deals API, Persons API
- **Brevo**: Lists API, Contacts Import API

## Workflow Details

### App Startup
1. Fetch current Pipedrive filters
2. Upsert to SQLite (mark new ones as unused)
3. Display to user

### New Sync Flow
1. User selects unused filters
2. Submit → show spinner
3. For each filter: create Brevo list → fetch deals → extract contacts → batch import
4. On success: mark filter used, store brevo_list_id, show counts
5. On failure: show error in UI, send Telegram alert

### Overwrite Flow
1. User selects existing synced filter
2. Submit → show spinner
3. Clear existing Brevo list contacts (or delete/recreate list)
4. Re-fetch from Pipedrive → batch import
5. Update job status, show counts

## Environment Variables
- `TELEGRAM_BOT_TOKEN` - Telegram bot token
- `TELEGRAM_CHAT_ID` - Telegram chat ID for alerts
- `PIPEDRIVE_API_KEY` - Pipedrive API key
- `BREVO_API_KEY` - Brevo API key
- `APP_PASSWORD` - Shared password for access

## Success Criteria
- User can view unused Pipedrive filters
- User can sync selected filters to new Brevo lists
- User can overwrite existing synced filters with fresh data
- All contacts from Pipedrive appear in Brevo (count verification)
- Errors trigger Telegram notifications
- SQLite replaces Airtable completely
