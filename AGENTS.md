# AGENTS.md - Pipedrive -> Brevo Sync Tool Development Guide

This document provides guidelines and commands for agentic coding agents working on this internal tool.

## Project Overview

A SvelteKit application that syncs Pipedrive deal filters with Brevo contact lists, replacing an existing n8n + Airtable + Fillout workflow. The app fetches Pipedrive filters, allows users to create new Brevo lists or overwrite existing ones with filtered deal contacts, and tracks sync jobs in SQLite. Supports Telegram error notifications and single-password authentication.

**Tech Stack:**

- Bun as the package manager (bun instead of npm / bunx instead of npx)
- bun instead of npm / bunx instead of npx
- Svelte 5 with SvelteKit
- TypeScript 5
- Tailwind 4
- Shadcn-svelte components (Shadcn/ui port for Svelte)
- Drizzle ORM with SQLite
- Playwright for E2E testing

## Build Commands

| Command           | Description                                        |
| ----------------- | -------------------------------------------------- |
| `bun run dev`     | Start development server                           |
| `bun run build`   | Build for production                               |
| `bun run preview` | Preview production build                           |
| `bun run check`   | Run TypeScript and Svelte checks, regenerate types |

## Lint and Format Commands

| Command               | Description                     |
| --------------------- | ------------------------------- |
| `bun run format`      | Format code with Prettier       |
| `bun run lint`        | Run Prettier and ESLint checks  |
| `bun run db:push`     | Push schema changes to database |
| `bun run db:generate` | Generate Drizzle migrations     |

## Test Commands

| Command                             | Description          |
| ----------------------------------- | -------------------- |
| `bun run test`                      | Run all E2E tests    |
| `bun run test:e2e e2e/demo.test.ts` | Run single test file |
| `bun run test:e2e --reporter=list`  | Use list reporter    |

## Interaction Guidelines

- Single responsibility - If asked for X, only do X. Don't "while you're at it" other improvements
- Questionable additions - If tempted to add something unasked, ask first: "Should I also change X?" or "I noticed Y could be improved - would you like that too?"
- When bash command asks for input / selection, ALWAYS ASK the user to run the command himself

## Code Style Guidelines

### Simplicity

Always start with the simplest solution using basic primitives. Only add complexity when the simple approach demonstrably fails.

If a solution requires workarounds (calc offsets, z-index stacking, manual subscriptions), step back and reconsider the approach. Complexity is a cost that must be justified.

### TypeScript

- Use explicit types for function parameters and return values
- Prefer interfaces over type aliases for object shapes

### Svelte 5

- Use runes (`$state`, `$derived`, `$effect`) for reactivity:
  - `$state()` for reactive state.
  - `$derived()` for computed values.
  - `$effect()` for side effects.
- Use `$props()` for component props. Use `$bindable()` only for two-way bindings.
- Events: Use standard attributes (`onclick={fn}`). For component events, pass callback props (e.g., `onsubmit={fn}`).
- Components accept callback functions as prop.
- Templates: Use `{#snippet name(args)}...{/snippet}` and `{@render name(args)}`. Replace all `<slot />` with `children` snippets.
- Keep components small and focused.
- If types for `+page.svelte` from the `load()` function are missing, regenerate them using `bun run check`

### Imports

- Use `$lib` alias for imports from `./src/lib`
- Group imports: external → internal → relative
- Named exports for utilities and types

### Naming Conventions

| Construct  | Convention           | Example                     |
| ---------- | -------------------- | --------------------------- |
| Variables  | camelCase            | `userId`, `workoutDate`     |
| Constants  | SCREAMING_SNAKE_CASE | `MAX_WEIGHT`                |
| Types      | PascalCase           | `WorkoutSession`            |
| Components | PascalCase           | `WorkoutCard`               |
| Files      | kebab-case           | `workout-tracker.ts`        |
| DB columns | snake_case           | `user_id`, `expires_at`     |
| DB tables  | snake_case (plural)  | `users`, `workout_sessions` |

### Error Handling

- Handle errors at the beginning of functions
- Use early returns for error conditions
- Avoid deeply nested if statements
- Use guard clauses for preconditions

### Formatting (Prettier)

- Use tabs for indentation
- Use single quotes for strings
- No trailing commas
- Print width: 100 characters

### Database (Drizzle ORM)

- Tables are defined in `./src/lib/server/db/schema.ts`
- Use `sqliteTable` for table definitions
- Columns use snake_case naming
- Use `$inferSelect` and `$inferInsert` for types

### Data Loading

`+page.server.ts` is the default for all data loading. Access path params via `params`, search params via `url.searchParams`. Use `error()` and `redirect()` from `@sveltejs/kit`.

**Re-run triggers:** `load()` re-runs on ANY URL change—path params or search params. Use search params for state requiring different server data.

**Parent data:** Access via `await parent()` in child load functions. In `+page.svelte`, layout and page data merge into single `data` prop.

### Form Actions

Use `+page.server.ts` `actions` export for mutations. Access form data via `request.formData()`. Return errors with `fail(status, data)`. Use `use:enhance` for progressive enhancement.

**Post-action refresh:** `load()` re-runs automatically after successful action. No manual invalidation needed for same-page updates.
