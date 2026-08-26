# Liga del Saber — Backend

<p align="center" >
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
  <img src="./public/photos/logo.jpeg" width="120" alt="app logo" />
</p>



NestJS backend for **Liga del Saber**, a knockout knowledge-tournament platform where each match is a free-text quiz graded by an AI evaluator. Full product/architecture docs live at the repo root — see [Where to look next](#where-to-look-next).

## Current stage: MVP monolith — backend complete

Per the roadmap's MVP path, this backend is intentionally a **single modular NestJS app**, not the microservices architecture that's the long-term target. Each bounded context is an internal Nest module here first; splitting them into separate services (`auth-service`, `tournament-service`, etc.) happens later, once the MVP is validated with real users.

- One process, one port, one PostgreSQL database (see root `docker-compose.yml` / `schema.sql`).
- Modules talk to each other via direct DI calls (Nest module imports/exports) — no Kafka in the MVP.
- No API Gateway, no Redis, no MongoDB yet — those belong to the full architecture (roadmap section 5). Ranking, for example, is a plain Postgres ledger summed on the fly instead of a Redis sorted set.
- No formal TypeORM migrations yet — schema changes are applied by hand against the running container and mirrored into `schema.sql` (`synchronize: false` on purpose, so TypeORM never silently rewrites the schema).

**All 10 roadmap phases are implemented** (Fase 0 through Fase 10 — auth, admin CRUD, player registration, bracket engine, question-by-question quiz, AI evaluator + scoring formula, dispute chat, ranking, and admin override), simplified to fit the monolith per section 6 of the roadmap. What's next is either building the frontend, or migrating this backend toward the full microservices architecture (section 5) once the MVP has been validated.

### Modules

| Module | Owns |
|---|---|
| `auth` | Register, login, refresh/logout, JWT (access + rotating refresh), roles (`player`/`admin`/`referee`) |
| `tournament` | Event CRUD (unique name, power-of-2 player count, referee calendar overlap check) |
| `registration` | Player self-registration + admin on-behalf, capped at the event's `maxPlayers` |
| `stage` | Bracket engine (`src/stage/bracket.ts`, pure + unit tested) — draws the first stage on registration close, then auto-advances every later stage (semifinal → final + third place) as real winners come in |
| `match` | The largest module — match scheduling/participants, per-match AI question generation, question-by-question quiz flow with timers, AI answer evaluation, the 70/30 scoring formula, and Fase 10 admin overrides |
| `dispute-chat` | In-match chat between the two players, the event's referee, and admin |
| `ranking` | Global + per-event leaderboard, computed from a Postgres ledger (`ranking_history`) |

There is deliberately **no `question` module** — questions used to live in a shared per-event bank, which turned out to be the wrong model (it let a player who already played leak upcoming questions to one who hadn't). Each match now generates and owns its own questions when it's scheduled; see `CLAUDE.md` for the full history of that redesign.

For the exact, currently-correct list of every endpoint with working `curl` examples, see **`curl-commands.md`** in this directory — it's updated every time an endpoint is added or changed, and is more trustworthy than prose summaries (including this one) if they ever disagree.

Interactive Swagger UI is also served at **`/docs`** once the app is running (`http://localhost:3000/docs` by default) — every route, DTO and role requirement, generated from the code via `@nestjs/swagger`. Click "Authorize" and paste an `accessToken` from `POST /auth/login` to call protected routes straight from the browser.

## Auth module

- `POST /auth/register` — creates a user (always role `player` — the first admin is bootstrapped by hand in the DB), hashes the password with bcrypt, returns `{ accessToken, refreshToken, user }`.
- `POST /auth/login` — verifies credentials, returns the same shape.
- `POST /auth/refresh` — rotates the refresh token (the old one stops working once used).
- `POST /auth/logout` — invalidates the stored refresh token.
- `register`/`login`/`refresh` are decorated `@Public()`; every other route in the app requires a valid JWT **by default**.
- **Global auth model:** `JwtAuthGuard` and `RolesGuard` are registered as `APP_GUARD` in `app.module.ts`. New routes are protected automatically — opt out explicitly with `@Public()` instead of opting in per route. Role gates use `@Roles(UserRole.ADMIN, ...)`; routes with no `@Roles` decorator just require *any* authenticated user, with finer-grained ownership checks (e.g. "are you one of this match's two players?") done inside the service.
- Inside a protected handler, the authenticated user (`{ id, email, role }`) is available via `@Req() req` → `req.user`, or the typed `@CurrentUser()` decorator (`src/auth/decorators/current-user.decorator.ts`).

## Match module — how a match actually plays out

This is the module worth understanding end to end, since it's where most of the business logic lives:

1. **`PATCH /matches/:id/schedule`** (admin) sets `scheduledStartAt`/`scheduledEndAt` and, in the same call, generates that match's questions by AI (Moonshot/Kimi — see below), evaluating against the event's theme and a fixed "hard" difficulty. Rescheduling always regenerates the questions from scratch.
2. **`POST /matches/:id/start`** (admin or referee) — blocked before `scheduledStartAt`, never after. Doesn't call the AI; it just activates the already-generated question set and starts the first question's timer.
3. Players call **`GET .../current-question`** and **`POST .../answers`** — each question is scored by AI as soon as both players answer it (or the deadline passes), not only at the end of the match, via a cron that ticks every 10 seconds.
4. When the last question closes, the match closes too: `walkover` if exactly one player answered *nothing at all* in the whole match, `closed` otherwise. Either way, the 70/30 quality/speed formula (`match-scoring-formula.ts`, pure and unit tested) computes the final score and winner, a ranking ledger entry is written per player, and — if that was the stage's last pending match — `stage` module draws the next stage with the real winners.
5. **Fase 10 (admin override)**, for post-match corrections: `PATCH .../answers/:id/override` lets admin correct a single AI score with a logged reason (recalculates the whole match result + ranking); `POST .../reopen` resets a closed match back to `pending` from scratch (clears answers, questions, scores) so admin can swap out a disqualified player and reschedule. Neither one cascades automatically into stages that already advanced past this match's old result — that correction is manual.

### AI provider

Both question generation and answer evaluation use **Moonshot AI (Kimi)** — an explicit user decision for the MVP (not Claude, despite the original design docs assuming Claude's Messages API). Both call sites use the OpenAI-compatible SDK (`openai` npm package) pointed at `https://api.moonshot.ai/v1`, model `kimi-k2.6`, with `response_format: json_schema` for structured output. Requires `MOONSHOT_API_KEY` in `.env`.

## Project setup

Requires the root Postgres to be running (see repo root `docker-compose.yml`):

```bash
# from the repo root
docker compose up -d
```

Then install and configure the backend:

```bash
npm install
cp .env.example .env   # already points at the docker-compose Postgres by default — add your own MOONSHOT_API_KEY
```

## Run

```bash
npm run start:dev   # watch mode
npm run start        # no watch
npm run start:prod   # compiled build
```

## Test

```bash
npm run test       # unit (Vitest) — no DB needed, covers the bracket engine and the scoring formula
npm run test:e2e   # e2e
npm run test:cov   # coverage
```

## Environment variables

See `.env.example`. Required (the app fails fast on boot if any is missing):

- `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` — Postgres connection (`DB_HOST`/`DB_PORT` default to `localhost`/`5432`, matching the root `docker-compose.yml`).
- `JWT_SECRET`, `JWT_REFRESH_SECRET` — must be different from each other (an access token must not double as a valid refresh token). `JWT_EXPIRES_IN` (default `1d`) and `JWT_REFRESH_EXPIRES_IN` (default `30d`) are optional.
- `MOONSHOT_API_KEY` — required by the `match` module for question generation and answer evaluation.

## Where to look next

- `../CLAUDE.md` — business rules, data model, scoring formula, architecture decisions, and a running log of design corrections made while building this backend (worth reading before assuming an older doc is still accurate).
- `curl-commands.md` — every implemented endpoint with a working `curl` example, kept current.
- `../liga-del-saber-roadmap.md` — full roadmap, MVP scope (section 6), target microservices architecture (section 5).
- `../schema.sql` / `../schema.dbml` — current Postgres schema (monolith draft; will be split per service when this backend moves to microservices).
- `../knowledge/nestjs.md` — NestJS theory notes, including the microservices patterns this project will migrate to later.
