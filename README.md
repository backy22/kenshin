# Kenshin

Kenshin helps people track health checkups: what to schedule, how often, where it is typically done, past visit results, and upcoming reminders. The stack is **FastAPI** (GraphQL + REST auth), **PostgreSQL**, and **Remix** (SSR).

Screening intervals come from configurable **age and gender rules** in the database. They are informational defaults only; always follow your clinician’s advice.

## Prerequisites

- [Docker](https://www.docker.com/products/docker-desktop/) and [Docker Compose](https://docs.docker.com/compose/install/)
- [Node.js](https://nodejs.org/) 20 or later (see `frontend/package.json`)
- [npm](https://www.npmjs.com/) (bundled with Node)

## Quick start

### Backend (Docker)

From the repository root:

```bash
docker compose up --build
```

- GraphQL: http://localhost:8000/graphql  
- OpenAPI docs: http://localhost:8000/docs  
- REST auth: `POST http://localhost:8000/auth/login`, `POST http://localhost:8000/auth/register`

The API runs database migrations and seeds on startup (users, catalog items, screening rules). If you change Python dependencies, rebuild so the image matches `api/requirements.txt`:

```bash
docker compose build --no-cache api
docker compose up -d api
```

### Frontend (local)

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:3000  

Sign in or register in the browser. The Remix server stores a **session cookie** and sends a **JWT** to GraphQL as `Authorization: Bearer <token>`.

### Default accounts (development seed)

After a fresh database (for example `docker compose down -v` then `up`), seeded users use password **`password`**:

| Email | Role |
|--------|------|
| `admin@example.com` | `ADMIN` |
| `sarah.j@example.com`, `emily.chen@example.com`, … | `USER` |

## Features (high level)

- **Users and roles**: `USER` and `ADMIN`. Passwords are hashed; JWTs are issued on login/register.
- **GraphQL** is authenticated: most queries and mutations require a valid Bearer token. Admins can manage users, catalog items, and screening rules; regular users see and edit only their own schedules and histories.
- **Guidelines**: `ScreeningRule` rows (age band, gender scope, interval in days, priority) plus `suggestScreeningInterval` for a user and item. Each schedule (`TestSet`) still stores the chosen **frequency** as the source of truth after the user accepts or edits it.
- **Items**: display name, `name_key` for i18n, optional `where_guidance_en`, and a fallback `default_frequency` when no rule matches.
- **Reminders**: `reminder_lead_days` and `last_reminder_at` on each schedule; a daily background task logs due windows; `upcomingReminders` supports the UI.
- **History**: adding a visit advances `next_date` by the schedule’s frequency from the visit date.
- **i18n**: English strings live under `frontend/app/i18n/`; Japanese is stubbed for a later translation pass.

## Docker commands

```bash
docker compose up -d          # detached
docker compose logs -f api    # API logs
docker compose down           # stop
docker compose down -v        # stop and wipe DB volume (full reset)
docker compose up --build     # rebuild and run
```

## Project structure

```
kenshin/
├── api/
│   ├── Model/              # SQLModel tables (user, item, test_set, history, screening_rule, …)
│   ├── Repository/
│   ├── Service/
│   ├── Graphql/            # Strawberry schema and resolvers
│   ├── routers/            # REST (e.g. auth)
│   ├── auth_security.py    # JWT and password hashing
│   ├── database_init.py    # create_all, migrations, seeds
│   ├── main.py
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── routes/         # Remix routes (login, register, schedule, admin, profile, …)
│   │   ├── i18n/
│   │   ├── lib/graphql-client.ts
│   │   ├── session.server.ts
│   │   └── root.tsx
│   └── package.json
├── docker-compose.yml
└── README.md
```

## Environment variables

See [`.env.example`](.env.example) for copy-paste placeholders. Copy it to `.env` at the repo root when running locally (values are also mirrored in `docker-compose.yml` for the API service where applicable).

### API (set in `docker-compose.yml` or your host)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Async SQLAlchemy URL (e.g. `postgresql+asyncpg://…`) |
| `JWT_SECRET` | Secret for signing JWTs (change in production) |
| `GEMINI_API_KEY` | Google AI Studio key for **regional screening suggestions** (`recommendCheckups`). If unset, the query fails until you configure a key. |
| `GEMINI_MODEL` | Optional Gemini model id (default `gemini-2.0-flash`). |
| `KENSHIN_SYNC_DEV_ADMIN` | If `1` / `true`, each API startup resets `admin@example.com` to password `password` and role `ADMIN`. **Disable in production.** Enabled in `docker-compose.yml` for local development. |

### Remix (frontend)

| Variable | Purpose |
|----------|---------|
| `API_URL` | Base URL of the API from the **Node server** (default `http://localhost:8000`) |
| `SESSION_SECRET` | Secret for signing the session cookie (default exists for dev only; set in production) |

### Postgres (Compose service `db`)

`POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` are defined in `docker-compose.yml`.

### If admin login fails

Use **`admin@example.com`** / **`password`**.

1. **Restart the API** (with Docker Compose as committed): `KENSHIN_SYNC_DEV_ADMIN=1` reapplies that password on every boot.
2. **Incremental seed:** missing seed users (including admin) are added on startup without wiping the database.
3. **Full reset:** `docker compose down -v` then `docker compose up --build` removes all Postgres data and reseeds everything.

## GraphQL and auth

In GraphQL Playground or any client, add an HTTP header:

```http
Authorization: Bearer <your_jwt>
```

Obtain a JWT via `POST /auth/login` or `POST /auth/register`, or by signing in through the Remix app.

**Admin-only** examples (require `ADMIN` token): `getAllUsers`, `createUser`, `createItem`, `screeningRules`, screening-rule mutations.

**Authenticated user** examples: `me`, `getAllTestSets`, `createTestSet`, `suggestScreeningInterval`, `upcomingReminders`, `updateUser` (self).

### Example: create a schedule (GraphQL)

```graphql
mutation {
  createTestSet(
    testSetData: {
      userId: 1
      itemId: 1
      frequency: 365
      nextDate: "2026-06-01"
      reminderLeadDays: 14
    }
  ) {
    id
    nextDate
    reminderLeadDays
    item { name whereGuidanceEn }
  }
}
```

### Example: admin creates a user (GraphQL)

```graphql
mutation {
  createUser(
    userData: {
      name: "Jane Doe"
      email: "jane@example.com"
      birthday: "1992-05-20"
      gender: FEMALE
      initialPassword: "changeme-please"
    }
  ) {
    id
    email
    role
  }
}
```

