# Authentication Implementation Plan

## Overview

Implement single-password authentication using Lucia-style session management with seeded user, no public registration.

## Steps

### 1. Database Schema Update

- File: `src/lib/server/db/schema.ts`
- Add `passwordHash: text('password_hash').notNull()` to user table
- Run `bun run db:push`

### 2. User Seeding Script

- File: `scripts/seed-user.ts`
- Hash password with argon2
- Insert single user into database
- Usage: `bun scripts/seed-user.ts <username> <password>`

### 3. Login Page

- File: `src/routes/login/+page.server.ts`
- Actions: login only (no register)
- Load: redirect to / if already authenticated
- File: `src/routes/login/+page.svelte`
- Use Card, Input, Button components
- Clean login form UI

### 4. Route Protection

- File: `src/routes/+page.server.ts`
- Load: redirect to /login if not authenticated
- Actions: logout action

### 5. Layout

- File: `src/routes/+layout.svelte`
- Basic app shell with navigation
- Logout button in header/navbar

## Technical Details

- Session management: `@oslojs/crypto` and `@oslojs/encoding` (already in use)
- Password hashing: `@node-rs/argon2` (already installed)
- Components: shadcn-svelte (Card, Input, Button)
- No public registration - user created via seed script only
