# Smart Skin Backend API Documentation

## Base Information

| Item | Value |
|------|-------|
| **Base URL** | `http://localhost:3000` (dev) / `https://api-ss.stas-rg.com` (prod) |
| **Framework** | NestJS 11 + TypeORM + PostgreSQL |
| **Content-Type** | `application/json` |
| **CORS** | Enabled (origin: `http://ss.stas-rg.com/`) |

---

## Table of Contents

1. [Sensor Readings API](#sensor-readings-api)
2. [Sensor Management API](#sensor-management-api)
3. [Database Schema](#database-schema)
4. [Performance Optimization](#performance-optimization)
5. [Error Responses](#error-responses)

---

## Sensor Readings API

### 1. POST `/sensor-reading/batch`  **RECOMMENDED**

Bulk insert readings from all sensors in a single request. **Optimized for high-frequency hardware data (42 sensors/5sec).**

**Request Body:**
```typescript
{
  mannequinId?: number;  // optional — 1 or 2, default: 1 (backward compatible)
  readings: [
    {
      sensorType: string;    // "temperature" | "pressure" | "vibration" | "flex" | "strain"
      sensorNumber: number;  // 1–4 (arm/leg/back); always 1 for elbow/knee
      value: number;
      location: string;      // see Locations reference table
    }
  ]
}
```

**Example Request:**
```bash
curl -X POST http://localhost:3000/sensor-reading/batch \
  -H "Content-Type: application/json" \
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
        "sensorType": "temperature",
        "sensorNumber": 2,
        "value": 36.8,
        "location": "left_arm"
      },
      {
        "sensorType": "pressure",
        "sensorNumber": 1,
        "value": 101.3,
        "location": "back"
      }
    ]
  }'
```

**Success Response (201):**
```json
{
  "saved": 42,
  "locations": ["right arm", "left arm", "back", "right leg", "left leg"]
}
```

**Performance:**
- ✅ 1 HTTP request for all 50 sensors (per mannequin)
- ✅ 1 DB query (bulk insert)
- ✅ In-memory cache for validation (0 lookup queries)
- ✅ ~20-40ms latency

---

### 2. POST `/sensor-reading`

Insert readings for a single location. **Legacy endpoint, use batch for better performance.**

**Request Body:**
```typescript
{
  location: string;  // "right_arm" | "left_arm" | "back" | "right_leg" | "left_leg"
                     // ⚠️ Legacy endpoint — does not support elbow/knee locations or flex/strain types
  readings: [
    {
      sensorType: string;    // "temperature" | "pressure" | "vibration"
      sensorNumber: number;  // 1-4
      value: number;
    }
  ]
}
```

**Example Request:**
```bash
curl -X POST http://localhost:3000/sensor-reading \
  -H "Content-Type: application/json" \
  -d '{
    "location": "right_arm",
    "readings": [
      {
        "sensorType": "temperature",
        "sensorNumber": 1,
        "value": 36.5
      },
      {
        "sensorType": "temperature",
        "sensorNumber": 2,
        "value": 36.8
      }
    ]
  }'
```

**Success Response (201):**
```json
{
  "saved": 2,
  "location": "right arm"
}
```

---

### 3. GET `/sensor-reading/latest` 

Get the latest reading for each sensor type. **Used by frontend dashboard for real-time display.**

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `mannequin_id` | number | No | 1 | Mannequin to query (1 or 2) |

**Example Request:**
```bash
# Mannequin 1 (default)
curl http://localhost:3000/sensor-reading/latest

# Mannequin 2
curl "http://localhost:3000/sensor-reading/latest?mannequin_id=2"
```

**Success Response (200):**
```json
[
  {
    "sensorType": "temperature",
    "unit": "°C",
    "value": 36.5,
    "timestamp": "2026-04-10T09:22:39.000Z"
  },
  {
    "sensorType": "pressure",
    "unit": "N",
    "value": 52.3,
    "timestamp": "2026-04-10T09:22:38.000Z"
  },
  {
    "sensorType": "vibration",
    "unit": "V",
    "value": 0.42,
    "timestamp": "2026-04-10T09:22:37.000Z"
  },
  {
    "sensorType": "flex",
    "unit": "Ω",
    "value": 98500,
    "timestamp": "2026-04-10T09:22:37.000Z"
  },
  {
    "sensorType": "strain",
    "unit": "µε",
    "value": 14200,
    "timestamp": "2026-04-10T09:22:37.000Z"
  }
]
```

**Frontend Usage:**
```javascript
// Fetch every 3 seconds for real-time dashboard
setInterval(async () => {
  const url = new URL(`${API_BASE}/sensor-reading/latest`);
  url.searchParams.set("mannequin_id", String(mannequinId)); // 1 or 2
  const data = await fetch(url.toString()).then(r => r.json());
  const temperature = data.find(s => s.sensorType === 'temperature');
  console.log(`Current temp: ${temperature.value} °C`);
}, 3000);
```

---

### 4. GET `/sensor-reading/paginated`

Get paginated sensor readings with filters. **Used by frontend detail page for charts.**

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | No | 1 | Page number (1-based) |
| `limit` | number | No | 10 | Items per page (max recommended: 50) |
| `sensorType` | string | No | - | Filter by sensor type |
| `location` | string | No | - | Filter by location (use underscore: `right_arm`) |
| `startDate` | string | No | - | Filter by start date (ISO 8601) |
| `endDate` | string | No | - | Filter by end date (ISO 8601) |
| `mannequin_id` | number | No | 1 | Mannequin to query (1 or 2) |

**Example Request:**
```bash
# Mannequin 1 (default)
curl "http://localhost:3000/sensor-reading/paginated?sensorType=temperature&location=right_arm&page=1&limit=20"

# Mannequin 2
curl "http://localhost:3000/sensor-reading/paginated?sensorType=temperature&location=right_arm&page=1&limit=20&mannequin_id=2"
```

**Success Response (200):**
```json
{
  "data": [
    {
      "id": 1,
      "value": 36.5,
      "timestamp": "2026-04-10T09:22:39.000Z",
      "sensor": {
        "id": 1,
        "externalId": 1,
        "sensorType": {
          "id": 1,
          "name": "temperature",
          "unit": "degC"
        },
        "location": {
          "id": 1,
          "name": "right arm"
        }
      }
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

**Frontend Usage (DetailPage):**
```javascript
// Fetch every 1 second for real-time charts
setInterval(async () => {
  const url = new URL(`${API_BASE}/sensor-reading/paginated`);
  url.searchParams.set("sensorType", "temperature");
  url.searchParams.set("location", "right_arm");
  url.searchParams.set("page", "1");
  url.searchParams.set("limit", "21");
  url.searchParams.set("mannequin_id", String(mannequinId)); // 1 or 2

  const res = await fetch(url.toString());
  const json = await res.json();
  // json.data contains readings for chart
}, 1000);
```

---

### 5. GET `/sensor-reading/sensor-types`

Get all available sensor types.

**Example Request:**
```bash
curl http://localhost:3000/sensor-reading/sensor-types
```

**Success Response (200):**
```json
[
  { "name": "temperature", "unit": "°C"  },
  { "name": "pressure",    "unit": "N"   },
  { "name": "vibration",   "unit": "V"   },
  { "name": "flex",        "unit": "Ω"   },
  { "name": "strain",      "unit": "µε"  }
]
```

---

### 6. GET `/sensor-reading/:sensorTypeName`

Get paginated readings for a specific sensor type.

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sensorTypeName` | string | Yes | `temperature` | `pressure` | `vibration` |

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | No | 1 | Page number |
| `limit` | number | No | 10 | Items per page |
| `location` | string | No | - | Filter by location |
| `startDate` | string | No | - | Filter by start date (ISO 8601) |
| `endDate` | string | No | - | Filter by end date (ISO 8601) |

**Example Request:**
```bash
curl "http://localhost:3000/sensor-reading/temperature?page=1&limit=20&location=right_arm"
```

**Success Response (200):**
```json
{
  "data": [
    {
      "id": 1,
      "value": 36.5,
      "timestamp": "2026-04-10T09:22:39.000Z",
      "sensor": {
        "id": 1,
        "externalId": 1,
        "sensorType": {
          "id": 1,
          "name": "temperature",
          "unit": "degC"
        },
        "location": {
          "id": 1,
          "name": "right arm"
        }
      }
    }
  ],
  "meta": {
    "total": 50,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

---

## LoRa API

### POST `/lora`

Receive a decoded LoRa uplink packet from TTN or Chirpstack and store the sensor readings. Supports multiple readings per packet across different locations.

> **BREAKING CHANGE — 2026-05-19:** Only **Format C (Compact Tuple)** is accepted. The old grouped/flat formats now return `400`. See `LORA_TTS_INTEGRATION.md` for migration steps.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `mid` | number | No | Optional cross-check. If present, must equal payload `m`; otherwise 400. |

**Request Body** — TTN v3 / Chirpstack envelope. The `decoded_payload` object must contain:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `m` | integer | Yes | Mannequin ID (1 or 2) |
| `r` | array | Yes | Non-empty array of reading tuples `[locationId, sensorNumber, sensorTypeId, value]` |

**Sensor Type ID:**

| ID | Name | Unit |
|----|------|------|
| 1 | temperature | °C |
| 2 | pressure | N |
| 3 | vibration | V |
| 4 | flex | Ω |
| 5 | strain | µε |

**Location ID & sensorNumber range:**

| ID | location | sensorNumber | allowed sensor type IDs |
|----|----------|--------------|--------------------------|
| 1 | right_arm | 1 – 2 | 1, 2, 3 |
| 2 | left_arm | 1 – 2 | 1, 2, 3 |
| 3 | back | 1 – 4 | 1, 2, 3 |
| 4 | right_leg | 1 – 3 | 1, 2, 3 |
| 5 | left_leg | 1 – 3 | 1, 2, 3 |
| 6 | right_elbow | 1 | 4, 5 |
| 7 | left_elbow | 1 | 4, 5 |
| 8 | right_knee | 1 | 4, 5 |
| 9 | left_knee | 1 | 4, 5 |

**Example — TTN v3 envelope (Mannequin 1, 3 readings at `back` sensorNumber 1):**
```bash
curl -X POST "http://localhost:3000/lora" \
  -H "Content-Type: application/json" \
  -d '{
    "uplink_message": {
      "decoded_payload": {
        "m": 1,
        "r": [
          [3, 1, 1, 36.5],
          [3, 1, 2, 101.3],
          [3, 1, 3, 0.05]
        ]
      }
    }
  }'
```

**Example — Chirpstack / raw decoded_payload (Mannequin 2, Group B):**
```bash
curl -X POST "http://localhost:3000/lora" \
  -H "Content-Type: application/json" \
  -d '{
    "decoded_payload": {
      "m": 2,
      "r": [
        [6, 1, 4, 95000],
        [6, 1, 5, 15000]
      ]
    }
  }'
```

**Success Response (200):**
```json
{
  "status": "ok",
  "message": "success to store lora data",
  "data": {
    "saved": 3,
    "locations": ["back"]
  }
}
```

**Supported payload envelope formats (tried in order):**
1. `body.uplink_message.decoded_payload` — TTN v3
2. `body.object.uplink_message.decoded_payload` — TTN (wrapped)
3. `body.decoded_payload` — Chirpstack
4. `body.object` — raw object

**Error Responses:**
```json
// 400 — missing or invalid m
{ "statusCode": 400, "message": "Missing or invalid \"m\" (mannequin ID required in payload, integer >= 1)" }

// 400 — query mid mismatch
{ "statusCode": 400, "message": "Mannequin mismatch: payload m=1 vs query mid=2" }

// 400 — empty r
{ "statusCode": 400, "message": "\"r\" must be a non-empty tuple array" }

// 400 — tuple shape
{ "statusCode": 400, "message": "r[0]: expected [locationId, sensorNumber, sensorTypeId, value]" }

// 400 — unknown location ID
{ "statusCode": 400, "message": "r[0]: unknown locationId 99" }

// 400 — sensorNumber out of range
{ "statusCode": 400, "message": "r[0]: sensorNumber 3 out of range 1..2 for right_arm" }

// 400 — group mismatch (e.g. arm + flex)
{ "statusCode": 400, "message": "r[0]: location right_arm does not support sensor type flex" }
```

---

## Sensor Management API

### 1. POST `/sensor`

Create a new sensor.

**Request Body:**
```typescript
{
  externalId: number;        // Sensor point number (1-4)
  sensorTypeId: number;      // Foreign key to sensor_type
  locationId: number;        // Foreign key to location (optional)
}
```

**Example Request:**
```bash
curl -X POST http://localhost:3000/sensor \
  -H "Content-Type: application/json" \
  -d '{
    "externalId": 5,
    "sensorTypeId": 1,
    "locationId": 1
  }'
```

**Success Response (201):**
```json
{
  "id": 43,
  "externalId": 5,
  "sensorType": {
    "id": 1,
    "name": "temperature"
  },
  "location": {
    "id": 1,
    "name": "right arm"
  }
}
```

---

### 2. GET `/sensor`

Get all sensors.

**Example Request:**
```bash
curl http://localhost:3000/sensor
```

**Success Response (200):**
```json
[
  {
    "id": 1,
    "externalId": 1,
    "sensorType": {
      "id": 1,
      "name": "temperature",
      "unit": "degC"
    },
    "location": {
      "id": 1,
      "name": "right arm"
    }
  }
]
```

---

## Database Schema

### Tables

#### `mannequin`
| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `name` | VARCHAR(100) | Mannequin name (e.g. "Mannequin 1") |

#### `sensor_type`
| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `name` | VARCHAR(50) | Sensor type name (temperature, pressure, vibration, flex, strain) |
| `unit` | VARCHAR(20) | Measurement unit (°C, N, V, Ω, µε) |

#### `location`
| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `name` | VARCHAR(100) | Location name (right arm, left arm, back, etc.) — shared across mannequins |

#### `sensor`
| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `externalId` | INT | Sensor point number (1-4) |
| `sensor_type_id` | INT | FK → sensor_type.id |
| `location_id` | INT | FK → location.id (nullable) |
| `mannequin_id` | INT | FK → mannequin.id (nullable) |

#### `sensor_reading`
| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `sensor_id` | INT | FK → sensor.id |
| `value` | DECIMAL(10,4) | Measured value |
| `timestamp` | TIMESTAMPTZ | Reading timestamp (default: NOW()) |

---

## Reference Data

### Mannequins

| ID | Name |
|----|------|
| 1 | `Mannequin 1` |
| 2 | `Mannequin 2` |

### Sensor Types

| ID | Name | Unit | Hardware Component | Max | Danger Threshold |
|----|------|------|--------------------|-----|-----------------|
| 1 | `temperature` | `°C` | MCP9808 | 50 °C | 38 °C |
| 2 | `pressure` | `N` | FSR RP-S40-ST | 98.07 N | 45–70 N |
| 3 | `vibration` | `V` | Piezoelectric | 3 V | — |
| 4 | `flex` | `Ω` | Flex Sensor | 125 000 Ω | 95 000–105 000 Ω |
| 5 | `strain` | `µε` | Strain Gauge | 20 000 µε | 12 000–20 000 µε |

### Locations (shared across all mannequins)

| ID | Name | Sensor Points | Compatible Types | Sensors per Mannequin |
|----|------|---------------|------------------|-----------------------|
| 1 | `right arm` | 2 | temperature, pressure, vibration | 6 (2 × 3) |
| 2 | `left arm` | 2 | temperature, pressure, vibration | 6 |
| 3 | `back` | 4 | temperature, pressure, vibration | 12 |
| 4 | `left leg` | 3 | temperature, pressure, vibration | 9 |
| 5 | `right leg` | 3 | temperature, pressure, vibration | 9 |
| 6 | `right elbow` | 1 | flex, strain | 2 (1 × 2) |
| 7 | `left elbow` | 1 | flex, strain | 2 |
| 8 | `right knee` | 1 | flex, strain | 2 |
| 9 | `left knee` | 1 | flex, strain | 2 |
| **Total per mannequin** | | | | **50 sensors** |
| **Total (2 mannequins)** | | | | **100 sensors** |

---

## Performance Optimization

### Architecture Overview

**Problem:** 50 sensors sending data every 5 seconds = 600 readings/min

**Solution Implemented:**

| Optimization | Before | After | Improvement |
|--------------|--------|-------|-------------|
| HTTP requests/5sec | 50 | 1 (batch) | **98% ↓** |
| DB queries/request | 4 | 1 | **75% ↓** |
| Total DB load/5sec | 168 queries | 1 query | **99.4% ↓** |
| Write latency | 100-200ms | 20-40ms | **80% ↓** |

### Key Optimizations

#### 1. In-Memory Caching
- **Service:** `SensorCacheService`
- **Refresh interval:** Every 5 minutes
- **Cached data:** Locations, sensor types, sensors
- **Impact:** Eliminates 3 DB lookups per write request

#### 2. Batch Insert Endpoint
- **Endpoint:** `POST /sensor-reading/batch`
- **Use case:** Hardware sends all 42 sensors in 1 request
- **Impact:** 42x reduction in HTTP requests

#### 3. Database Indexes
```sql
-- Location lookup (every write request)
CREATE INDEX idx_location_name ON location(name);

-- Sensor type lookup (every write request)
CREATE INDEX idx_sensor_type_name ON sensor_type(name);

-- Sensor lookup (write validation)
CREATE INDEX idx_sensor_type_location ON sensor(sensor_type_id, location_id);

-- Time-series queries (pagination, charts)
CREATE INDEX idx_sensor_reading_sensor_timestamp ON sensor_reading(sensor_id, timestamp DESC);

-- Date range queries
CREATE INDEX idx_sensor_reading_timestamp_only ON sensor_reading(timestamp DESC);
```

#### 4. Connection Pool
```typescript
extra: {
  max: 30,              // Max connections
  min: 10,              // Min connections (keep warm)
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
}
```

### Migration Setup

```bash
# Run database migration (add indexes)
cd backend-sensor
npm run migration:run

# Seed database (create locations, sensor types, sensors)
npm run seeder
```

---

## Error Responses

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": [
    "sensorType should not be empty",
    "sensorNumber must not be less than 1",
    "value should not be empty"
  ],
  "error": "Bad Request"
}
```

**Common causes:**
- Missing required fields
- Invalid data types
- Validation rule violations

---

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Location \"invalid_location\" not found",
  "error": "Not Found"
}
```

**Common causes:**
- Invalid location name
- Invalid sensor type name
- Sensor not found for given location/type/number combination

---

### 404 Not Found (Sensor Type)
```json
{
  "statusCode": 404,
  "message": "Sensor type \"humidity\" not found",
  "error": "Not Found"
}
```

**Valid sensor types:** `temperature`, `pressure`, `vibration`, `flex`, `strain`

---

### 500 Internal Server Error
```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error"
}
```

**Common causes:**
- Database connection issues
- Unhandled exceptions

---

## Frontend Integration Guide

### Dashboard Page (`/dashboard`)

**Endpoint:** `GET /sensor-reading/latest?mannequin_id={id}`

**Polling interval:** 3000ms (3 seconds)

**Purpose:** Display real-time values for each sensor type (Temperature, Pressure, Vibration). Includes mannequin selector dropdown.

**Example:**
```javascript
const [mannequinId, setMannequinId] = useState(1); // 1 or 2

useEffect(() => {
  const fetchData = async () => {
    const url = new URL(`${API_BASE}/sensor-reading/latest`);
    url.searchParams.set("mannequin_id", String(mannequinId));
    const data = await fetch(url.toString()).then(r => r.json());
    // Map to dashboard state...
  };
  
  fetchData();
  const interval = setInterval(fetchData, 3000);
  return () => clearInterval(interval);
}, [mannequinId]); // re-fetches when mannequin changes
```

---

### Detail Page (`/sensor/:sensorKey`)

**Endpoint:** `GET /sensor-reading/paginated?mannequin_id={id}`

**Polling interval:** 1000ms (1 second)

**Purpose:** Fetch time-series data for charts per sensor type and location. Includes mannequin selector dropdown.

**Example:**
```javascript
const [mannequinId, setMannequinId] = useState(1);

useEffect(() => {
  const fetchAllParts = async () => {
    const requests = PARTS.map(async (part) => {
      const url = new URL(`${API_BASE}/sensor-reading/paginated`);
      url.searchParams.set("sensorType", meta.backendType);
      url.searchParams.set("location", PART_TO_BACKEND_LOCATION[part]);
      url.searchParams.set("page", "1");
      url.searchParams.set("limit", "21");
      url.searchParams.set("mannequin_id", String(mannequinId));

      const res = await fetch(url.toString());
      const json = await res.json();
      return { part, readings: json.data };
    });

    const results = await Promise.allSettled(requests);
    // Process results and update chart data
  };

  fetchAllParts();
  const interval = setInterval(fetchAllParts, 1000);
  return () => clearInterval(interval);
}, [sensorKey, mannequinId]); // re-fetches when mannequin or sensor type changes
```

---

### Hardware Integration (Batch Example)

```javascript
// Collect data from 42 sensors every 5 seconds
async function sendSensorData() {
  const allReadings = [];
  
  // Example: right arm sensors
  allReadings.push({
    sensorType: "temperature",
    sensorNumber: 1,
    value: 36.5,
    location: "right_arm"
  });
  allReadings.push({
    sensorType: "temperature",
    sensorNumber: 2,
    value: 36.8,
    location: "right_arm"
  });
  
  // ... add all 42 sensors
  
  try {
    const response = await fetch(`${API_BASE}/sensor-reading/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ readings: allReadings })
    });
    
    const result = await response.json();
    console.log(`Saved ${result.saved} readings`);
  } catch (error) {
    console.error("Failed to send sensor data:", error);
  }
}

// Send every 5 seconds
setInterval(sendSensorData, 5000);
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `127.0.0.1` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USERNAME` | `postgres` | Database user |
| `DB_PASSWORD` | `1` | Database password |
| `DB_NAME` | `hardware` | Database name |
| `DB_SYNCHRONIZATION` | `false` | Auto-sync schema (dev only) |
| `DB_LOGGING` | `false` | Enable SQL logging (dev only) |
| `PORT` | `3000` | Backend server port |

---

## Quick Start

### 1. Database Setup
```bash
# Start PostgreSQL (via Docker)
cd backend-sensor
docker-compose up -d
```

### 2. Run Migrations
```bash
npm run migration:run
```

### 3. Seed Database
```bash
npm run seeder
```

### 4. Start Backend
```bash
# Development
npm run start:dev

# Production
npm run start:prod
```

### 5. Test Endpoints
```bash
# Check health
curl http://localhost:3000/sensor-reading/sensor-types

# Send test data
curl -X POST http://localhost:3000/sensor-reading/batch \
  -H "Content-Type: application/json" \
  -d '{
    "readings": [
      {
        "sensorType": "temperature",
        "sensorNumber": 1,
        "value": 36.5,
        "location": "right_arm"
      }
    ]
  }'

# Get latest readings
curl http://localhost:3000/sensor-reading/latest
```

---

## Changelog

### v4.0 — Hardware Spec v2: New Sensors + Locations (May 2026)
- ✅ Updated `pressure` unit: `kPa` → `N` (FSR RP-S40-ST, max 98.07 N, danger 45–70 N)
- ✅ Updated `vibration` unit: `g` → `V` (Piezoelectric, max 3 V)
- ✅ Added `flex` sensor type: `Ω` (Flex Sensor, max 125 000 Ω, danger 95 000–105 000 Ω)
- ✅ Added `strain` sensor type: `µε` (Strain Gauge, max 20 000 µε, danger 12 000–20 000 µε)
- ✅ Added 4 new locations: `right elbow`, `left elbow`, `right knee`, `left knee` (1 sensor point each)
- ✅ Seeder splits seeding into Group A (old locations × old types) and Group B (new locations × new types)
- ✅ Total sensors per mannequin: 42 → **50**; total (2 mannequins): 84 → **100**
- ✅ LoRa endpoint updated to accept `flex` and `strain` payload fields and new locations
- ✅ No schema changes — only data changes (idempotent seeder handles unit updates)

### v3.0 — Multi-Mannequin + LoRa (May 2026)
- ✅ Added `mannequin` table to database — supports multiple physical mannequins
- ✅ Added `mannequin_id` FK to `sensor` table — 84 sensors total (42 per mannequin)
- ✅ Added `POST /lora` endpoint — receive LoRa packets from TTN/Chirpstack for either mannequin
- ✅ `GET /sensor-reading/latest` now accepts `?mannequin_id` param (default: 1)
- ✅ `GET /sensor-reading/paginated` now accepts `?mannequin_id` param (default: 1)
- ✅ `POST /sensor-reading/batch` now accepts optional `mannequinId` field (default: 1)
- ✅ `SensorCacheService` cache key updated to include mannequin dimension
- ✅ All changes are backward compatible — existing callers without `mannequin_id` default to Mannequin 1

### v2.0 — Performance Optimization
- ✅ Added `POST /sensor-reading/batch` for bulk insert (99.4% performance improvement)
- ✅ Added `GET /sensor-reading/latest` for real-time dashboard display
- ✅ Implemented in-memory caching for reference data
- ✅ Added database indexes for time-series queries
- ✅ Optimized connection pool for high-write workload
- ✅ Removed `GET /sensor-reading` (replaced with paginated endpoint)

---

## Support

For issues or questions:
- Check logs: `npm run start:dev` (includes detailed logging)
- Review migration status: `npm run typeorm migration:show`
- Contact: Backend development team

---

**Last Updated:** May 8, 2026  
**API Version:** 4.0 (Hardware Spec v2: New Sensors + Locations)
