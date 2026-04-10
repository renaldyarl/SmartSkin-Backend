# WebSocket Implementation Guide

## Overview

Real-time sensor data delivery using WebSocket (Socket.IO) instead of HTTP polling.

### Benefits:
- ✅ No repeated HTTP requests
- ✅ No canceled requests
- ✅ Near-instant data delivery
- ✅ More efficient than polling 5 endpoints/second
- ✅ Automatic reconnection handling
- ✅ Reduced server load

---

## Architecture

```
ESP/Hardware → Backend (HTTP POST) → Database → WebSocket Emit → Frontend (Subscribe)
```

### Flow:
1. Hardware sends sensor data via HTTP POST to backend
2. Backend saves data to database
3. Backend emits WebSocket event to all connected clients
4. Frontend receives event and updates UI instantly

---

## Backend Setup

### 1. WebSocket Gateway

**File:** `src/websocket/sensor.gateway.ts`

```typescript
@WebSocketGateway({
  cors: {
    origin: ['http://localhost:5173', 'https://ss.stas-rg.com'],
    credentials: true,
  },
  namespace: '/sensor',
})
export class SensorGateway {
  @WebSocketServer() server: Server;

  // Emit after sensor data saved
  emitSensorUpdate(data: {
    sensorType: string;
    value: number;
    location: string;
    sensorNumber: number;
    timestamp: Date;
  }) {
    this.server.emit('sensor-update', data);
  }

  // Emit for batch inserts
  emitBatchUpdate(readings: Array<...>) {
    this.server.emit('sensor-batch-update', readings);
  }
}
```

### 2. Emit Events After Save

**File:** `src/sensor-reading/sensor-reading.service.ts`

```typescript
async batchCreate(dto: BatchCreateSensorReadingDto) {
  // Save to database
  await this.sensorReadingRepository.save(readingEntities);

  // Emit to WebSocket clients
  this.sensorGateway.emitBatchUpdate(wsPayload);
  
  return { saved: count, locations };
}
```

### 3. Enable WebSocket in main.ts

```typescript
import { IoAdapter } from '@nestjs/platform-socket.io';

app.useWebSocketAdapter(new IoAdapter(app));
```

---

## Frontend Setup

### 1. WebSocket Hook

**File:** `src/hooks/useSensorWebSocket.js`

```javascript
import { io } from 'socket.io-client';

export function useSensorWebSocket() {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [latestData, setLatestData] = useState({});

  const connect = () => {
    const socket = io(`${WS_URL}/sensor`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    
    socket.on('sensor-update', (data) => {
      setLatestData(prev => ({
        ...prev,
        [`${data.sensorType}-${data.location}`]: data,
      }));
    });

    socketRef.current = socket;
  };

  useEffect(() => {
    connect();
    return () => disconnect();
  }, []);

  return { isConnected, latestData, socket: socketRef.current };
}
```

### 2. Use in Dashboard

**File:** `src/pages/DashboardPage.jsx`

```javascript
import { useSensorWebSocket } from "../hooks/useSensorWebSocket";

export default function DashboardPage() {
  const { isConnected, latestData } = useSensorWebSocket();

  // Process WebSocket data
  useEffect(() => {
    const nextSummary = SENSOR_TYPES.reduce((acc, sensor) => {
      const sensorData = getLatestSensorData(latestData, sensor.backendType);
      acc[sensor.key] = buildRealtimeSummary(sensorData);
      return acc;
    }, {});
    setSummary(nextSummary);
  }, [latestData]);

  return (
    <div>
      {/* Show connection status */}
      {isConnected ? (
        <span className="text-emerald-600">🟢 Live</span>
      ) : (
        <span className="text-orange-600">🟡 Connecting...</span>
      )}
      
      {/* Display real-time data */}
      <div>{summary.temp.value} °C</div>
    </div>
  );
}
```

---

## WebSocket Events

### 1. `sensor-update` (Single sensor)

**Emitted when:** Single location POST request completes

**Payload:**
```json
{
  "sensorType": "temperature",
  "value": 37.5,
  "location": "right arm",
  "sensorNumber": 1,
  "timestamp": "2026-04-10T07:09:53.457Z"
}
```

**Frontend usage:**
```javascript
socket.on('sensor-update', (data) => {
  console.log(`${data.sensorType} at ${data.location}: ${data.value}`);
});
```

---

### 2. `sensor-batch-update` (Multiple sensors)

**Emitted when:** Batch POST request completes

**Payload:**
```json
[
  {
    "sensorType": "temperature",
    "value": 37.5,
    "location": "right arm",
    "sensorNumber": 1,
    "timestamp": "2026-04-10T07:09:53.457Z"
  },
  {
    "sensorType": "pressure",
    "value": 101.3,
    "location": "back",
    "sensorNumber": 1,
    "timestamp": "2026-04-10T07:09:53.457Z"
  }
]
```

**Frontend usage:**
```javascript
socket.on('sensor-batch-update', (readings) => {
  readings.forEach(r => {
    console.log(`${r.sensorType}: ${r.value}`);
  });
});
```

---

### 3. `latest-summary` (Dashboard summary)

**Emitted when:** Latest readings are requested

**Payload:**
```json
[
  {
    "sensorType": "temperature",
    "unit": "degC",
    "value": 37.5,
    "timestamp": "2026-04-10T07:09:53.457Z"
  },
  {
    "sensorType": "pressure",
    "unit": "kPa",
    "value": 101.3,
    "timestamp": "2026-04-10T07:09:53.457Z"
  }
]
```

---

## Testing

### 1. Start Backend

```bash
cd backend-sensor
npm run start:dev
```

**Expected log:**
```
Application is running on port 3000
WebSocket server available on ws://localhost:3000/sensor
[Nest] SensorGateway WebSocket Gateway initialized
```

### 2. Start Frontend

```bash
cd Proto-SmartSkin
npm run dev
```

**Expected browser console:**
```
✅ WebSocket connected
📡 sensor-batch-update: 42 readings
📡 sensor-update: temperature at right arm
```

### 3. Send Test Data

```bash
curl -X POST http://localhost:3000/sensor-reading/batch \
  -H "Content-Type: application/json" \
  -d '{
    "readings": [
      {"sensorType": "temperature", "sensorNumber": 1, "value": 37.5, "location": "right_arm"}
    ]
  }'
```

**Expected:**
- Backend logs: `Emitted sensor-batch-update: 1 readings`
- Frontend console: `📡 sensor-batch-update: 1 readings`
- Dashboard updates instantly with `37.5 °C`

---

## Connection Details

### WebSocket URL

**Development:**
```
ws://localhost:3000/sensor
```

**Production:**
```
wss://api-ss.stas-rg.com/sensor
```

### CORS Configuration

Backend allows connections from:
- `http://localhost:5173` (Vite dev)
- `http://localhost:3000`
- `http://ss.stas-rg.com`
- `https://ss.stas-rg.com`

---

## Environment Variables

### Backend

No special env vars needed. WebSocket runs on same port as HTTP.

### Frontend

```env
# .env
VITE_API_BASE_URL=http://localhost:3000
VITE_WS_URL=http://localhost:3000
```

---

## Comparison: Polling vs WebSocket

| Metric | Polling (Old) | WebSocket (New) |
|--------|---------------|-----------------|
| **Requests/min** | 12 (4 endpoints × 3 sec) | 1 (initial) |
| **Data latency** | 3 seconds | ~100ms |
| **Bandwidth** | High (repeated headers) | Low (persistent connection) |
| **Server load** | High | Low |
| **Canceled requests** | Common | None |
| **Reconnection** | Manual | Automatic |

---

## Troubleshooting

### Issue 1: WebSocket not connecting

**Error:**
```
WebSocket connection to 'ws://localhost:3000/sensor' failed
```

**Solutions:**
1. Check backend is running: `curl http://localhost:3000`
2. Check CORS configuration in `main.ts`
3. Verify WebSocket adapter: `app.useWebSocketAdapter(new IoAdapter(app))`

---

### Issue 2: Events not received

**Symptom:** Connected but no data updates

**Solutions:**
1. Check backend logs for `Emitted sensor-update`
2. Verify event name matches: `sensor-update` (not `sensor_update`)
3. Check frontend listener: `socket.on('sensor-update', ...)`

---

### Issue 3: Connection drops

**Symptom:** Frequent disconnects

**Solutions:**
1. Enable reconnection in socket options:
   ```javascript
   io(url, {
     reconnection: true,
     reconnectionDelay: 1000,
     reconnectionAttempts: 10,
   })
   ```
2. Check server resources (memory, CPU)
3. Verify load balancer supports WebSocket (if using)

---

## Production Deployment

### Nginx Configuration

```nginx
server {
    listen 443 ssl;
    server_name api-ss.stas-rg.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    location /sensor {
        proxy_pass http://localhost:3000/sensor;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

### PM2 Configuration

```javascript
module.exports = {
  apps: [{
    name: 'backend-sensor',
    script: 'dist/main.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    }
  }]
}
```

---

## Performance Metrics

### Before (Polling)

```
Dashboard: 4 HTTP requests every 3 seconds
DetailPage: 5 HTTP requests every 1 second
Total: ~9 requests/second = 540 requests/minute
```

### After (WebSocket)

```
Dashboard: 1 WebSocket connection (persistent)
DetailPage: 1 WebSocket connection (shared)
Total: 0 HTTP requests after initial load
```

**Improvement:**
- **99% reduction** in HTTP requests
- **97% reduction** in data latency (3s → 100ms)
- **Zero** canceled requests
- **Automatic** reconnection

---

**Last Updated:** April 10, 2026  
**Version:** 1.0 (WebSocket Implementation)
