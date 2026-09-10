# SmartSkin Backend

Backend service for the SmartSkin mannequin sensor monitoring system. It receives device data through a LoRa webhook or REST API, stores sensor readings in PostgreSQL, provides APIs for the dashboard, and broadcasts real-time updates through Socket.IO.

## Key features

- JWT-based administrator authentication
- LoRa data ingestion from The Things Stack (TTS) and ChirpStack
- Batch sensor ingestion for high-frequency write workloads
- Support for two mannequins with 100 seeded sensors
- Filtering, pagination, latest readings, and CSV export
- Real-time updates through WebSocket
- In-memory cache for locations, sensor types, and sensors
- Database schema management with TypeORM migrations

## Tech stack

| Component | Technology |
| --- | --- |
| Framework | NestJS 11 |
| Language | TypeScript 5.7 |
| Database | PostgreSQL 16 |
| ORM | TypeORM 0.3 |
| Authentication | Passport JWT and bcrypt |
| Real-time communication | Socket.IO |
| Validation | class-validator and class-transformer |
| Testing | Jest and Supertest |

## Prerequisites

Make sure the following tools are installed:

- Node.js 20 or later
- npm
- PostgreSQL, or Docker to run PostgreSQL

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the environment

Copy the environment template:

```bash
cp .env.example .env
```

Then update `.env` with the appropriate values. The minimum configuration for a local database started with Docker Compose is:

```env
APP_PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=smart_skin
DB_LOGGING=true
DB_SYNCHRONIZATION=false

JWT_SECRET=replace-with-a-long-random-string
JWT_EXPIRES_IN=12h
```

Do not use the example `JWT_SECRET` or default passwords in production.

### 3. Start PostgreSQL

If you use Docker:

```bash
docker compose up -d postgres
```

The database created by `docker-compose.yml` is named `smart_skin`. Make sure `DB_NAME` in `.env` uses the same name. If PostgreSQL is installed locally, create a database and update the `DB_*` variables accordingly.

### 4. Prepare the schema and seed data

```bash
npm run migration:run
npm run seeder
npm run seed:admin
```

`npm run seeder` creates two mannequins, nine locations, five sensor types, and 100 sensors. This seeder is only available when `NODE_ENV` is not set to `production`.

`npm run seed:admin` creates or updates two administrator accounts. Configure their passwords in `.env` before running the command:

```env
ADMIN_STASRG_USERNAME=stas-rg
ADMIN_STASRG_PASSWORD=use-a-strong-password
ADMIN_PINDAD_USERNAME=pindad
ADMIN_PINDAD_PASSWORD=use-a-strong-password
```

### 5. Start the application

```bash
npm run start:dev
```

The application is available at:

- REST API: `http://localhost:3000`
- Socket.IO namespace: `http://localhost:3000/sensor`

Check that the server is running:

```bash
curl http://localhost:3000/
```

## Authentication

Most endpoints are protected by a global JWT guard. Obtain a token from the login endpoint:

```bash
curl -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"stas-rg","password":"use-a-strong-password"}'
```

Use the returned token to access protected endpoints:

```bash
curl http://localhost:3000/auth/me \
  -H 'Authorization: Bearer ACCESS_TOKEN'
```

The following endpoints are public:

- `GET /`
- `POST /auth/login`
- `POST /lora`
- `GET /lora/health`
- `POST /sensor-reading`
- `POST /sensor-reading/batch`

All other HTTP endpoints require an `Authorization: Bearer <token>` header. The WebSocket connection does not currently use JWT authentication.

## API overview

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| `POST` | `/auth/login` | Public | Sign in and obtain an access token |
| `GET` | `/auth/me` | JWT | Get the current user's profile |
| `POST` | `/lora` | Public | Receive a Format C LoRa webhook |
| `GET` | `/lora/health` | Public | Get the data connection status for each mannequin |
| `GET` | `/lora/diagnostics` | JWT | Get LoRa packet latency statistics |
| `POST` | `/sensor-reading/batch` | Public | Store multiple sensor readings |
| `POST` | `/sensor-reading` | Public | Store readings for one location |
| `GET` | `/sensor-reading/latest` | JWT | Get the latest value for each sensor type |
| `GET` | `/sensor-reading/paginated` | JWT | Get filtered and paginated readings |
| `GET` | `/sensor-reading/:sensorTypeName` | JWT | Get readings by sensor type |
| `GET` | `/sensor-reading/sensor-types` | JWT | List available sensor types |
| `GET` | `/sensor-reading/export` | JWT | Export one day of readings as CSV |
| `GET` | `/sensor-reading/debug/cache` | JWT | Inspect the reference-data cache |
| `GET` | `/sensor` | JWT | List sensors |
| `POST` | `/sensor` | JWT | Create a sensor |

See the [API documentation](docs/API_DOCUMENTATION.md) for detailed request bodies, responses, filters, and error codes.

## Sending sensor data

The batch endpoint is recommended for devices because it stores multiple readings in one request.

```bash
curl -X POST http://localhost:3000/sensor-reading/batch \
  -H 'Content-Type: application/json' \
  -d '{
    "mannequinId": 1,
    "readings": [
      {
        "sensorType": "temperature",
        "sensorNumber": 1,
        "value": 36.5,
        "location": "right_arm"
      },
      {
        "sensorType": "pressure",
        "sensorNumber": 1,
        "value": 42.8,
        "location": "back"
      }
    ]
  }'
```

Example response:

```json
{
  "saved": 2,
  "locations": ["right arm", "back"]
}
```

Location names may use underscores, such as `right_arm`. The backend converts them to spaces before looking up the corresponding sensor.

## LoRa payload format

`POST /lora` accepts the compact tuple-based Format C payload:

```json
{
  "m": 1,
  "r": [
    [1, 1, 1, 36.5],
    [3, 1, 2, 42.8]
  ]
}
```

Each tuple uses the following order:

```text
[locationId, sensorNumber, sensorTypeId, value]
```

The payload may also be nested in a TTS `uplink_message.decoded_payload` envelope or a supported ChirpStack envelope. ID mappings and decoder examples are available in the [LoRa integration guide](docs/LORA_TTS_INTEGRATION.md).

## WebSocket

Use a Socket.IO client and connect to the `/sensor` namespace:

```ts
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/sensor');

socket.on('sensor-batch-update', (readings) => {
  console.log(readings);
});
```

The `sensor-batch-update` event is emitted after data from a sensor-reading endpoint or LoRa webhook is stored successfully. Each item includes `sensorType`, `value`, `location`, `sensorNumber`, `timestamp`, and `mannequin_id`.

## Data model

```text
mannequin
    └── sensor ── sensor_type
          │
          ├────── location
          │
          └── sensor_reading

app_user
```

The seeded reference data includes:

- Sensor types: `temperature`, `pressure`, `vibration`, `flex`, and `strain`
- Main locations: right/left arm, back, and right/left leg
- Joint locations: right/left elbow and right/left knee
- Main-location sensors use temperature, pressure, and vibration
- Joint-location sensors use flex and strain

## Project structure

```text
src/
├── auth/             # Login, JWT strategy, guard, and users
├── cache/            # Sensor reference-data cache
├── config/           # Environment and TypeORM configuration
├── dto/              # Request DTOs and validation
├── location/         # Location entity
├── lora/             # LoRa webhook, health, and diagnostics
├── mannequin/        # Mannequin entity
├── migrations/       # Database schema migration history
├── seeder/           # Reference-data seeder
├── sensor/           # Sensor entity and API
├── sensor-reading/   # Ingestion, queries, statistics, and exports
├── websocket/        # Socket.IO gateway
├── app.module.ts
├── data-source.ts
└── main.ts

scripts/
├── run-seeder.ts
└── seed-admins.ts
```

## npm scripts

| Command | Description |
| --- | --- |
| `npm run start:dev` | Start the server in watch mode |
| `npm run build` | Compile the application into `dist/` |
| `npm run start:prod` | Run the compiled production build |
| `npm run lint` | Run ESLint with automatic fixes |
| `npm run format` | Format source code with Prettier |
| `npm test` | Run unit tests |
| `npm run test:e2e` | Run end-to-end tests |
| `npm run test:cov` | Run tests and generate a coverage report |
| `npm run migration:run` | Apply pending migrations |
| `npm run migration:revert` | Revert the latest migration |
| `npm run migration:generate -- src/migrations/MigrationName` | Generate a migration from entity changes |
| `npm run seeder` | Seed SmartSkin reference data |
| `npm run seed:admin` | Create or update administrator accounts |

To run the application in production mode locally:

```bash
npm run build
npm run start:prod
```

## Testing

```bash
npm test
npm run test:e2e
npm run test:cov
```

## Additional documentation

- [API documentation](docs/API_DOCUMENTATION.md)
- [LoRa and TTS integration](docs/LORA_TTS_INTEGRATION.md)
- [Sensor-reading pagination API](docs/SENSOR_READING_PAGINATION_API.md)
- [Performance optimization](docs/PERFORMANCE_OPTIMIZATION.md)
- [Debugging guide](docs/DEBUG_GUIDE.md)

## Deployment notes

- Keep `DB_SYNCHRONIZATION=false` and apply migrations during deployment.
- Use a strong and unique `JWT_SECRET` for every environment.
- Supply administrator passwords through environment variables, not source code.
- Restrict CORS origins and secure ingestion endpoints as required in production.
- The WebSocket connection and device-ingestion endpoints are currently public.

## License

This project is private and does not currently provide an open-source license.
