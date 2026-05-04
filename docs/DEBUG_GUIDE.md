# Debug Guide - Sensor Data Mapping

## Problem
Data dari hardware tidak sesuai dengan yang ditampilkan di dashboard (contoh: data paha kanan muncul di tangan kiri).

## Root Cause Analysis

### Flow Data yang Benar:

```
Hardware → Backend → Database → Frontend
```

### 1. Hardware → Backend

**Format yang diharapkan:**
```json
{
  "readings": [
    {
      "sensorType": "temperature",
      "sensorNumber": 1,
      "value": 36.5,
      "location": "right_arm"
    }
  ]
}
```

**Konversi lokasi:**
- Hardware mengirim: `right_arm` (dengan underscore)
- Backend convert: `right arm` (dengan spasi) via `replace(/_/g, ' ')`
- Database simpan: `right arm` (dengan spasi)

### 2. Backend → Database

**Cache Key Formula:**
```
key = `${sensorType}-${sensorNumber}-${locationName}`
```

Contoh:
- Hardware: `{ sensorType: "temperature", sensorNumber: 1, location: "right_arm" }`
- Convert: `locationName = "right arm"`
- Cache Key: `"temperature-1-right arm"`

**Database Query:**
```sql
SELECT * FROM sensor 
WHERE sensor_type_id = (SELECT id FROM sensor_type WHERE name = 'temperature')
  AND externalId = 1
  AND location_id = (SELECT id FROM location WHERE name = 'right arm');
```

### 3. Database → Frontend

**Frontend fetch:**
```javascript
// Dashboard
GET /sensor-reading/latest

// DetailPage  
GET /sensor-reading/paginated?sensorType=temperature&location=right_arm
```

**Backend mapping:**
- Frontend kirim: `location=right_arm`
- Backend convert: `locationName = "right arm"`
- Query: `WHERE location.name = 'right arm'`

---

## Verification Steps

### Step 1: Check Database Seeder

```bash
cd backend-sensor
npm run seeder
```

**Expected output:**
```
✅ Seeder: 5 locations, 3 sensor types, 42 sensors created!
```

**Verify locations:**
```sql
SELECT * FROM location;
```

Expected:
```
id | name
1  | right arm
2  | left arm
3  | back
4  | right leg
5  | left leg
```

### Step 2: Check Cache Status

```bash
curl http://localhost:3000/sensor-reading/debug/cache
```

**Expected response:**
```json
{
  "locations": [
    { "name": "right arm", "id": 1 },
    { "name": "left arm", "id": 2 },
    { "name": "back", "id": 3 },
    { "name": "right leg", "id": 4 },
    { "name": "left leg", "id": 5 }
  ],
  "sensorTypes": [
    { "name": "temperature", "id": 1, "unit": "degC" },
    { "name": "pressure", "id": 2, "unit": "kPa" },
    { "name": "vibration", "id": 3, "unit": "g" }
  ],
  "sensorCount": 42,
  "sampleSensors": [
    {
      "key": "temperature-1-right arm",
      "id": 1,
      "externalId": 1,
      "sensorTypeName": "temperature",
      "locationName": "right arm"
    }
  ]
}
```

### Step 3: Test Batch Insert

**Test with right leg data:**
```bash
curl -X POST http://localhost:3000/sensor-reading/batch \
  -H "Content-Type: application/json" \
  -d '{
    "readings": [
      {
        "sensorType": "temperature",
        "sensorNumber": 1,
        "value": 37.5,
        "location": "right_leg"
      }
    ]
  }'
```

**Expected success response:**
```json
{
  "saved": 1,
  "locations": ["right leg"]
}
```

**If error, check error message:**
```json
{
  "statusCode": 404,
  "message": "Sensor not found! Cache key: \"temperature-1-right leg\". Requested: type=\"temperature\", number=1, location=\"right leg\". Available sensors for this type: [temperature-1-right arm, temperature-2-right arm, ...]"
}
```

### Step 4: Verify Data in Database

```sql
SELECT 
  sr.value,
  sr.timestamp,
  st.name as sensor_type,
  l.name as location,
  s."externalId" as sensor_number
FROM sensor_reading sr
JOIN sensor s ON sr.sensor_id = s.id
JOIN sensor_type st ON s.sensor_type_id = st.id
JOIN location l ON s.location_id = l.id
ORDER BY sr.timestamp DESC
LIMIT 10;
```

Expected:
```
value | timestamp              | sensor_type | location  | sensor_number
37.5  | 2026-04-10 10:00:00   | temperature | right leg | 1
```

### Step 5: Check Latest Endpoint

```bash
curl http://localhost:3000/sensor-reading/latest
```

Expected:
```json
[
  {
    "sensorType": "temperature",
    "unit": "degC",
    "value": 37.5,
    "timestamp": "2026-04-10T10:00:00.000Z"
  }
]
```

---

## Common Issues & Solutions

### Issue 1: "Location not found in cache"

**Error:**
```
Location "right_leg" not found in cache. Available locations: right arm, left arm, back, right leg, left leg
```

**Cause:** Location name mismatch

**Solution:** 
- Hardware must send: `right_arm` (with underscore)
- Backend converts to: `right arm` (with space)
- Database stores: `right arm` (with space)

### Issue 2: "Sensor not found"

**Error:**
```
Sensor not found! Cache key: "temperature-5-right arm"
```

**Cause:** `sensorNumber` out of range

**Solution:**
- `right arm`: sensorNumber 1-2 only
- `left arm`: sensorNumber 1-2 only
- `back`: sensorNumber 1-4 only
- `right leg`: sensorNumber 1-3 only
- `left leg`: sensorNumber 1-3 only

### Issue 3: Data appears in wrong location

**Symptom:** Data from right leg appears in left arm

**Debug steps:**
1. Check cache: `GET /sensor-reading/debug/cache`
2. Verify sensor keys match expected pattern
3. Check database: `SELECT * FROM sensor WHERE location_id = X`

**Common causes:**
- Hardware sending wrong location
- Cache not refreshed (restart backend)
- Seeder not run or run incorrectly

---

## Quick Test Script

Create `test-data.js`:

```javascript
const API_BASE = 'http://localhost:3000';

async function test() {
  // Test 1: Send right leg temperature
  console.log('Test 1: Send right leg temperature...');
  const res1 = await fetch(`${API_BASE}/sensor-reading/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      readings: [
        {
          sensorType: 'temperature',
          sensorNumber: 1,
          value: 37.5,
          location: 'right_leg'
        }
      ]
    })
  });
  console.log('Response:', await res1.json());

  // Test 2: Check latest readings
  console.log('\nTest 2: Check latest readings...');
  const res2 = await fetch(`${API_BASE}/sensor-reading/latest`);
  const data = await res2.json();
  console.log('Latest readings:', JSON.stringify(data, null, 2));

  // Verify
  const temp = data.find(d => d.sensorType === 'temperature');
  if (temp) {
    console.log('\n✅ Temperature data received:', temp);
    
    // Check if it's from right leg by fetching paginated
    const res3 = await fetch(
      `${API_BASE}/sensor-reading/paginated?sensorType=temperature&location=right_leg&page=1&limit=1`
    );
    const paginated = await res3.json();
    console.log('Right leg temperature reading:', paginated.data[0]);
  }
}

test().catch(console.error);
```

Run:
```bash
node test-data.js
```

---

## Sensor Mapping Reference

### Right Arm (2 sensors per type)
- `right_arm` → `right arm` in database
- Sensor numbers: 1, 2
- Cache keys: `temperature-1-right arm`, `temperature-2-right arm`

### Left Arm (2 sensors per type)
- `left_arm` → `left arm` in database
- Sensor numbers: 1, 2
- Cache keys: `temperature-1-left arm`, `temperature-2-left arm`

### Back (4 sensors per type)
- `back` → `back` in database
- Sensor numbers: 1, 2, 3, 4
- Cache keys: `temperature-1-back`, `temperature-2-back`, etc.

### Right Leg (3 sensors per type)
- `right_leg` → `right leg` in database
- Sensor numbers: 1, 2, 3
- Cache keys: `temperature-1-right leg`, `temperature-2-right leg`, `temperature-3-right leg`

### Left Leg (3 sensors per type)
- `left_leg` → `left leg` in database
- Sensor numbers: 1, 2, 3
- Cache keys: `temperature-1-left leg`, `temperature-2-left leg`, `temperature-3-left leg`

---

## Hardware Integration Checklist

- [ ] Hardware sends location with underscore: `right_arm`, `left_leg`, etc.
- [ ] Sensor numbers are within valid range for each location
- [ ] Sensor types match: `temperature`, `pressure`, `vibration`
- [ ] Backend cache is initialized (check logs)
- [ ] Database has been seeded (run `npm run seeder`)
- [ ] Test with single reading first, then batch

---

**Last Updated:** April 10, 2026
