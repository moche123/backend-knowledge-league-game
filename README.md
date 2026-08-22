# Liga del Saber — Backend

<p align="center" >
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
  <img src="./public/photos/logo.jpeg" width="120" alt="app logo" />
</p>



NestJS backend for **Liga del Saber**, a knockout knowledge-tournament platform where each match is a free-text quiz graded by an AI evaluator. Full product/architecture docs live at the repo root — see [Where to look next](#where-to-look-next).

## Current stage: MVP monolith

Per the roadmap's MVP path, this backend is intentionally a **single modular NestJS app**, not the microservices architecture that's the long-term target. Each bounded context becomes an internal Nest module here first; splitting them into separate services (`auth-service`, `tournament-service`, etc.) happens later, once the MVP is validated.

- One process, one port, one PostgreSQL database (see root `docker-compose.yml` / `schema.sql`).
- Modules talk to each other via direct DI calls (or `EventEmitter2` later) — no Kafka in the MVP.
- No API Gateway, no Redis, no MongoDB yet — those belong to the full architecture (roadmap section 5).

### Modules

| Module | Status | Owns |
|---|---|---|
| `auth` | Implemented | Register, login, JWT issuing, roles (`player`/`admin`/`referee`) |
| `tournament` | Not started | Events, registrations, stages, bracket engine, referee calendar |
| `question` | Not started | AI-generated question bank per theme |
| `match` | Not started | Question-by-question quiz flow, timers, walkover |
| `ai-evaluator` | Not started | Answer grading against rubric, 70/30 quality/speed formula |
| `dispute-chat` | Not started | In-match chat between players and referee |
| `ranking` | Not started | Global leaderboard, ranking history ledger |

## Auth module

- `POST /auth/register` — creates a user (always role `player`), hashes the password with bcrypt, returns `{ accessToken, user }`.
- `POST /auth/login` — verifies credentials, returns `{ accessToken, user }`.
- Both are decorated `@Public()`; every other route in the app requires a valid JWT **by default**.
- **Global auth model:** `JwtAuthGuard` is registered as `APP_GUARD` in `app.module.ts`. New routes are protected automatically — opt out explicitly with `@Public()` instead of opting in per route.
- Inside a protected handler, the authenticated user (`{ id, email, role }`) is available via `@Req() req` → `req.user`, or the typed `@CurrentUser()` decorator (`src/auth/decorators/current-user.decorator.ts`).

## Project setup

Requires the root Postgres to be running (see repo root `docker-compose.yml`):

```bash
# from the repo root
docker compose up -d
```

Then install and configure the backend:

```bash
npm install
cp .env.example .env   # already points at the docker-compose Postgres by default
```

## Run

```bash
npm run start:dev   # watch mode
npm run start        # no watch
npm run start:prod   # compiled build
```

## Test

```bash
npm run test       # unit
npm run test:e2e   # e2e
npm run test:cov   # coverage
```

## Environment variables

See `.env.example`. `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`, and `JWT_SECRET` are required (the app fails fast on boot if any is missing).

## Where to look next

- `../CLAUDE.md` — business rules, data model, scoring formula, architecture decisions.
- `../liga-del-saber-roadmap.md` / `.en.md` — full roadmap, MVP scope (section 6), target architecture (section 5).
- `../schema.sql` / `../schema.dbml` — current Postgres schema (monolith draft; will be split per service when this backend moves to microservices).
- `../knowledge/nestjs.md` — NestJS theory notes, including the microservices patterns this project will migrate to later.
