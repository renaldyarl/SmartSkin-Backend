# Sensor Reading Pagination API Documentation

## Overview
New paginated endpoints for sensor readings, organized by sensor type. These endpoints allow hardware data to be sent and retrieved per sensor type with full pagination support.

## New Endpoints

### 1. GET `/sensor-reading/paginated`
Get all sensor readings with pagination and optional filters.

**Query Parameters:**
- `page` (optional, number): Page number (default: 1)
- `limit` (optional, number): Items per page (default: 10)
- `sensorType` (optional, string): Filter by sensor type (e.g., "temperature", "pressure", "vibration")
- `location` (optional, string): Filter by location (e.g., "right_arm", "left_leg")
- `startDate` (optional, string): Filter by start date (ISO 8601 format)
- `endDate` (optional, string): Filter by end date (ISO 8601 format)

**Example Request:**
```
GET /sensor-reading/paginated?page=1&limit=10&sensorType=temperature
```

**Example Response:**
```json
{
  "data": [
    {
      "id": 1,
      "value": 36.5000,
      "timestamp": "2026-04-09T10:30:00.000Z",
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
    "limit": 10,
    "totalPages": 15
  }
}
```

---

### 2. GET `/sensor-reading/:sensorTypeName`
Get sensor readings for a specific sensor type with pagination.

**URL Parameters:**
- `sensorTypeName` (required, string): The sensor type name (e.g., "temperature", "pressure", "vibration")

**Query Parameters:**
- `page` (optional, number): Page number (default: 1)
- `limit` (optional, number): Items per page (default: 10)
- `location` (optional, string): Filter by location
- `startDate` (optional, string): Filter by start date (ISO 8601 format)
- `endDate` (optional, string): Filter by end date (ISO 8601 format)

**Example Request:**
```
GET /sensor-reading/temperature?page=1&limit=20&location=right_arm
```

**Example Response:**
```json
{
  "data": [
    {
      "id": 1,
      "value": 36.5000,
      "timestamp": "2026-04-09T10:30:00.000Z",
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

### 3. GET `/sensor-reading/sensor-types`
Get all available sensor types.

**Example Request:**
```
GET /sensor-reading/sensor-types
```

**Example Response:**
```json
[
  {
    "name": "temperature",
    "unit": "degC"
  },
  {
    "name": "pressure",
    "unit": "kPa"
  },
  {
    "name": "vibration",
    "unit": "g"
  }
]
```

---

## Sending Hardware Data by Sensor Type

When sending data from hardware, you can use the existing POST endpoint. The data is automatically organized by sensor type on the backend.

### POST `/sensor-reading`
Create sensor readings (bulk insert).

**Request Body:**
```json
{
  "location": "right_arm",
  "readings": [
    {
      "sensorType": "temperature",
      "sensorNumber": 1,
      "value": 36.5
    },
    {
      "sensorType": "temperature",
      "sensorNumber": 1,
      "value": 36.8
    }
  ]
}
```

**Example Response:**
```json
{
  "saved": 2,
  "location": "right arm"
}
```

---

## Available Sensor Types

Based on the seeder data, the following sensor types are available:

| Sensor Type | Unit | Description |
|-------------|------|-------------|
| `temperature` | `degC` | Temperature in degrees Celsius |
| `pressure` | `kPa` | Pressure in kilopascals |
| `vibration` | `g` | Vibration in g-force |

---

## Available Locations

| Location | Sensor Points |
|----------|---------------|
| `right_arm` | 2 |
| `left_arm` | 2 |
| `back` | 4 |
| `left_leg` | 3 |
| `right_leg` | 3 |

---

## Usage Examples

### Example 1: Get temperature readings with pagination
```bash
curl "http://localhost:3000/sensor-reading/temperature?page=1&limit=20"
```

### Example 2: Get pressure readings from right arm location
```bash
curl "http://localhost:3000/sensor-reading/pressure?location=right_arm&page=1&limit=10"
```

### Example 3: Get vibration readings within a date range
```bash
curl "http://localhost:3000/sensor-reading/vibration?startDate=2026-04-01T00:00:00Z&endDate=2026-04-09T23:59:59Z&page=1&limit=50"
```

### Example 4: Get all readings filtered by sensor type
```bash
curl "http://localhost:3000/sensor-reading/paginated?sensorType=temperature&page=1&limit=10"
```

---

## Error Responses

### 404 Not Found - Sensor type doesn't exist
```json
{
  "statusCode": 404,
  "message": "Sensor type \"invalid_type\" not found",
  "error": "Not Found"
}
```

---

## Files Modified/Created

### Created:
1. `src/dto/paginate-sensor-reading-query.dto.ts` - DTO for pagination query parameters
2. `src/dto/pagination-response.interface.ts` - Interface for paginated response structure

### Modified:
1. `src/sensor-reading/sensor-reading.service.ts` - Added pagination methods
2. `src/sensor-reading/sensor-reading.controller.ts` - Added new endpoints

---

## Notes

- All pagination uses 1-based indexing for pages
- Results are ordered by timestamp (newest first)
- Location names use underscores in query parameters but are stored with spaces in the database (automatic conversion)
- The `:sensorTypeName` parameter is validated against existing sensor types in the database
- Date filters use ISO 8601 format for timestamps
