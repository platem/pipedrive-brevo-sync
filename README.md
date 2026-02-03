# Pipedrive-Brevo Sync Bridge

A lightweight, single-tenant web application that synchronizes contact data from Pipedrive to Brevo. This tool replaces a complex multi-tool workflow (n8n, Airtable, Fillout) with a bespoke, reliable integration designed for sales teams to sync filtered Pipedrive deals into Brevo contact lists for email marketing campaigns.

## Features

- **Filter-based Sync**: Sync Pipedrive deal filters to Brevo contact lists
- **Dual Mode Operation**: Create new lists or overwrite existing ones
- **Job Tracking**: SQLite-based persistence of sync operations with detailed status
- **Concurrent Job Protection**: Built-in locking mechanism prevents overlapping syncs
- **Session-based Authentication**: Secure single-password access control
- **Rate Limit Handling**: Automatic throttling for API compliance
- **Batch Processing**: Optimized pagination and batching for large datasets

## Tech Stack

- **Runtime**: Bun
- **Framework**: SvelteKit with Svelte 5
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **Components**: shadcn-svelte
- **Database**: SQLite with Drizzle ORM
- **Authentication**: Session-based with Argon2 password hashing
- **Testing**: Vitest (unit) + Playwright (E2E)

## Project Structure

```
src/routes/
├── (auth)/login/          # Authentication flow
└── (app)/                 # Protected dashboard and sync workflows
    ├── /                  # Mode selection (sync new / overwrite)
    └── [mode]/            # Filter selection and sync execution
```

See [docs/architecture.md](docs/architecture.md) for detailed architecture specifications.

## Prerequisites

- Bun installed ([installation guide](https://bun.sh/docs/installation))
- Pipedrive account with API access
- Brevo account with API access

## Setup

### 1. Install Dependencies

```sh
bun install
```

### 2. Environment Configuration

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL=local.db

# Pipedrive API
PIPEDRIVE_API_KEY=your_pipedrive_api_key
PIPEDRIVE_BASE_URL=https://your-company.pipedrive.com/

# Brevo API
BREVO_API_KEY=your_brevo_api_key
BREVO_FOLDER_ID=1

# Authentication (for testing)
TEST_USER_USERNAME=testuser
TEST_USER_PASSWORD=testpassword
```

See [.env.example](.env.example) for a complete template.

### 3. Database Setup

Initialize the database schema:

```sh
bun run db:push
```

### 4. Create Initial User

Run the application and use the seed script or manually insert a user into the SQLite database with a hashed password.

## Development

Start the development server:

```sh
bun run dev
```

The application will be available at `http://localhost:5173`

### Available Commands

| Command               | Description                           |
| --------------------- | ------------------------------------- |
| `bun run dev`         | Start development server              |
| `bun run build`       | Build for production                  |
| `bun run preview`     | Preview production build              |
| `bun run check`       | Run TypeScript and Svelte type checks |
| `bun run format`      | Format code with Prettier             |
| `bun run lint`        | Run Prettier and ESLint checks        |
| `bun run db:push`     | Push schema changes to database       |
| `bun run db:generate` | Generate Drizzle migrations           |
| `bun run db:studio`   | Open Drizzle Studio (database GUI)    |
| `bun run test`        | Run all tests (unit + E2E)            |
| `bun run test:unit`   | Run Vitest unit tests                 |
| `bun run test:e2e`    | Run Playwright E2E tests              |

## Testing

The project includes comprehensive test coverage:

- **Unit Tests**: Vitest tests for server-side logic and validation
- **E2E Tests**: Playwright tests for authentication and critical user flows

See [docs/test-plan.md](docs/test-plan.md) for the complete testing strategy.

## Deployment

### Production Build

```sh
bun run build
```

### VPS Deployment with PM2

1. Install PM2 globally:

   ```sh
   npm install -g pm2
   ```

2. Start the application:

   ```sh
   pm2 start npm --name "pipedrive-brevo-sync" -- run preview
   ```

3. Configure PM2 to restart on reboot:

   ```sh
   pm2 startup
   pm2 save
   ```

4. **Important**: Ensure the SQLite database file (`local.db`) is persisted outside the build directory to survive deployments.

## How It Works

1. **Authentication**: Users log in with a shared password
2. **Dashboard**: Select sync mode (new list or overwrite existing)
3. **Filter Selection**: Choose one or more Pipedrive filters to sync
4. **Sync Execution**:
   - Fetch deals from Pipedrive (paginated)
   - Retrieve associated person details (batched)
   - Transform data (extract email, name, phone, ID)
   - Import to Brevo (batched, 50 contacts per request)
5. **Job Tracking**: All sync operations logged in SQLite with status and metrics
6. **Error Handling**: Failed syncs trigger UI notifications

## Documentation

- **[Product Requirements Document](docs/prd.md)**: Comprehensive feature specifications and requirements
- **[Architecture Specification](docs/architecture.md)**: Route structure and design patterns
- **[Test Plan](docs/test-plan.md)**: Testing strategy and coverage goals
- **[AGENTS.md](AGENTS.md)**: Development guidelines and code style conventions

## CI/CD

GitHub Actions workflows automatically run on every push to `main`:

**CI Workflow** ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)):

- Dependency installation
- Type checking
- Unit tests
- Production build verification

**Deploy Workflow** ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)):

- Type checking
- Production build
- Automatic deployment to VPS via SSH
- PM2 process restart

### Required Secrets for VPS Deployment

Configure the following secrets in GitHub repository settings:

| Secret Name   | Description                        |
| ------------- | ---------------------------------- |
| `VPS_HOST`    | VPS IP address or hostname         |
| `VPS_USER`    | SSH username                       |
| `VPS_SSH_KEY` | Private SSH key for authentication |
| `VPS_PORT`    | SSH port                           |

## License

Internal tool - All rights reserved
