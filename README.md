# SmartSkin Backend

NestJS 11 + TypeORM + PostgreSQL backend for the SmartSkin mannequin sensor monitoring system. Receives sensor data (LoRa webhook / batch ingest), stores time-series readings, streams live updates over WebSocket, and serves a JWT-protected read API for the dashboard.

---

## Tech Stack

| Item | Value |
|------|-------|
| **Framework** | NestJS 11 |
| **ORM** | TypeORM 0.3 |
| **Database** | PostgreSQL |
| **Realtime** | Socket.IO (`/sensor` namespace) |
| **Auth** | JWT (`passport-jwt`) + bcrypt |
| **Validation** | class-validator / class-transformer |
| **Language** | TypeScript 5.7 |

---

## Project Structure

```
src/
├── auth/                 # JWT login gate (guard, strategy, login/me, User entity)
├── sensor/               # Sensor + SensorType entities, CRUD
├── sensor-reading/       # Readings: batch ingest, pagination, latest, CSV export
├── lora/                 # POST /lora webhook (Format C) + health + diagnostics
├── websocket/            # SensorGateway — broadcasts sensor-batch-update
├── cache/                # SensorCacheService — in-memory ref data (0 lookup queries)
├── mannequin/            # Mannequin entity (2 mannequins)
├── location/             # Location entity (9 locations)
├── seeder/               # Dev seeder (locations, types, sensors) — non-prod only
├── migrations/           # TypeORM migrations (schema is source-controlled)
├── config/               # env validation
├── dto/                  # request/response DTOs
├── data-source.ts        # TypeORM CLI datasource (migrations)
├── app.module.ts
└── main.ts               # bootstrap (CORS, global ValidationPipe, WS adapter)

scripts/
├── run-seeder.ts         # npm run seeder
└── seed-admins.ts        # npm run seed:admin
```

---

## Quick Start

```bash
npm install

# 1. Environment
cp .env.example .env          # then edit values (DB creds, JWT_SECRET, admin passwords)

# 2. Database (Postgres must be running and a DB matching DB_NAME must exist)
docker-compose up -d postgres # optional — provides a Postgres container
npm run migration:run         # create schema (sensors, readings, app_user, …)
npm run seeder                # seed 2 mannequins, 9 locations, 5 types, 100 sensors
npm run seed:admin            # seed the 2 admin accounts (stas-rg, pindad)

# 3. Run
npm run start:dev             # watch mode → http://localhost:3000
```

WebSocket: `ws://localhost:3000/sensor` (event `sensor-batch-update`).

> **Note:** `docker-compose.yml` creates a DB named `smart_skin`, while `.env.example` defaults `DB_NAME=hardware`. Make the two match (set `DB_NAME` or create the DB) before running migrations.

---

## NPM Scripts

| Script | What it does |
|--------|--------------|
| `npm run start:dev` | Start in watch mode |
| `npm run start:prod` | Run the compiled build (`dist/src/main`) — run `npm run build` first |
| `npm run build` | Compile to `dist/` (nest build) |
| `npm run lint` | ESLint (autofix) |
| `npm test` | Jest unit tests |
| `npm run migration:run` | Apply pending migrations |
| `npm run migration:revert` | Roll back the last migration |
| `npm run migration:generate` | Generate a migration from entity diffs |
| `npm run seeder` | Seed reference data (locations/types/sensors). **Dev only.** |
| `npm run seed:admin` | Idempotent upsert of the 2 admin accounts (runs in any env) |

---

## Environment Variables

See [`.env.example`](.env.example) for the full template.

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_PORT` | `3000` | HTTP/WS port |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USERNAME` | `postgres` | DB user |
| `DB_PASSWORD` | — | DB password |
| `DB_NAME` | `hardware` | Database name |
| `DB_LOGGING` | `true` | Log SQL (dev) |
| `DB_SYNCHRONIZATION` | `false` | Auto-sync schema — keep `false`, use migrations |
| `JWT_SECRET` | — (**required**) | Secret for signing JWTs — long random string |
| `JWT_EXPIRES_IN` | `12h` | Token lifetime (`12h`, `8h`, `7d`, …) |
| `ADMIN_STASRG_USERNAME` / `ADMIN_STASRG_PASSWORD` | `stas-rg` / — | Admin #1 seed creds |
| `ADMIN_PINDAD_USERNAME` / `ADMIN_PINDAD_PASSWORD` | `pindad` / — | Admin #2 seed creds |

---

## Authentication

Most endpoints are gated by a **global JWT guard** (deny-by-default). Send `Authorization: Bearer <token>` on protected requests; missing/invalid → `401`.

**Public (no token):** `POST /auth/login`, `POST /lora`, `GET /lora/health`, `POST /sensor-reading/batch`, `POST /sensor-reading`, `GET /`.
**Protected:** everything else.

```
POST /auth/login   { "username": "stas-rg", "password": "..." }  → { access_token, user }
GET  /auth/me      (Bearer token)                                 → current user
```

The 2 admin accounts are created by `npm run seed:admin` (passwords from env). Accounts live in the `app_user` table.

> ⚠️ The live WebSocket `/sensor` is **not** gated yet — see [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) changelog (known gap).

---

## API Endpoints (summary)

Full reference + Postman bodies: **[docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md)** (v7.0).

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/auth/login` | 🔓 | Get JWT |
| GET | `/auth/me` | 🔒 | Current user |
| POST | `/lora` | 🔓 | TTS/Chirpstack webhook (Format C) |
| GET | `/lora/health` | 🔓 | "Backend alive" badge |
| GET | `/lora/diagnostics` | 🔒 | TTS→BE latency / inter-arrival stats |
| POST | `/sensor-reading/batch` | 🔓 | Hardware bulk ingest |
| GET | `/sensor-reading/latest` | 🔒 | Latest value per sensor type |
| GET | `/sensor-reading/paginated` | 🔒 | Paginated readings (filters incl. `sensorNumber`) |
| GET | `/sensor-reading/export` | 🔒 | CSV export for a single day |
| GET | `/sensor-reading/sensor-types` | 🔒 | List sensor types |
| GET/POST | `/sensor` | 🔒 | List / create sensors |

---

## Data Model

`mannequin (2)` → `sensor (50/mannequin = 100)` → `sensor_reading (time-series)`; each `sensor` references a `location (9)` + `sensor_type (5)`. `app_user` holds admin accounts. Schema is managed via **migrations** (`src/migrations/`), not `synchronize`.

See the [Database Schema](docs/API_DOCUMENTATION.md#database-schema) and [Reference Data](docs/API_DOCUMENTATION.md#reference-data) sections for columns, sensor types, danger thresholds, and location/sensor mapping.

---

## Further Docs

- [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) — full API reference (v7.0)
- [docs/LORA_TTS_INTEGRATION.md](docs/LORA_TTS_INTEGRATION.md) — LoRa Format C + TTS decoder
- [docs/SENSOR_READING_PAGINATION_API.md](docs/SENSOR_READING_PAGINATION_API.md) — pagination endpoints
- [docs/PERFORMANCE_OPTIMIZATION.md](docs/PERFORMANCE_OPTIMIZATION.md) — caching, indexes, batch
- [docs/DEBUG_GUIDE.md](docs/DEBUG_GUIDE.md) — debugging
- `../LORA_DIAGNOSTICS.md` / `../SESSION_CHANGES_*.md` — diagnostics guide + changelogs
