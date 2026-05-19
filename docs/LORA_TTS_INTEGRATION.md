# LoRa TTS Integration — SmartSkin

Dokumen ini menjelaskan format payload LoRa yang dikirim dari hardware ke backend via **The Things Stack (TTS)** webhook.

---

> ## ⚠️ BREAKING CHANGE — 2026-05-19
>
> **Format A (grouped) dan Format B (flat) sudah TIDAK didukung.** Backend sekarang hanya menerima **Format C — Compact Tuple**.
>
> Firmware / fungsi `decodeUplink()` di TTS console **harus di-update** sebelum deploy backend versi ini, jika tidak semua request akan ditolak dengan `400 BadRequest`.
>
> Lihat section [Migrasi dari Format B → Format C](#migrasi-dari-format-b--format-c) di bawah.

---

## Alur Data

```
Hardware Node (LoRa) → TTS Gateway → TTS Decoder → Webhook POST /lora → BE
```

TTS menjalankan fungsi `decodeUplink()` di console-nya, lalu mengirim hasilnya sebagai:
```
uplink_message.decoded_payload → isi payload yang kamu tulis di decoder
```
Backend sudah handle unwrap TTS envelope ini secara otomatis di `lora.service.ts`.

---

## Hardware Sensors

| Hardware | Tipe DB | Sensor Type ID | Unit | Max | Batas Bahaya |
|----------|---------|----------------|------|-----|--------------|
| MCP9808 | `temperature` | **1** | °C | 50 | ≥ 38 |
| FSR RP-S40-ST | `pressure` | **2** | N | 98.07 | 45–70 |
| Piezoelektrik | `vibration` | **3** | V | 3 | — |
| Flex sensor | `flex` | **4** | Ω | 125,000 | 95k–105k |
| Strain gauge | `strain` | **5** | µε | 20,000 | 12k–20k |

## Locations

| Location ID | Name | Group | Max sensorNumber | Allowed sensor type IDs |
|-------------|------|-------|------------------|-------------------------|
| **1** | right_arm | A | 2 | 1, 2, 3 |
| **2** | left_arm | A | 2 | 1, 2, 3 |
| **3** | back | A | 4 | 1, 2, 3 |
| **4** | right_leg | A | 3 | 1, 2, 3 |
| **5** | left_leg | A | 3 | 1, 2, 3 |
| **6** | right_elbow | B | 1 | 4, 5 |
| **7** | left_elbow | B | 1 | 4, 5 |
| **8** | right_knee | B | 1 | 4, 5 |
| **9** | left_knee | B | 1 | 4, 5 |

> Source of truth: `backend-sensor/src/lora/lora-codes.ts`. Re-order = breaking change.

---

## Format C — Compact Tuple

```json
{
  "m": 1,
  "r": [
    [3, 1, 1, 30.5],
    [3, 1, 2, 45.2],
    [3, 1, 3, 1.2]
  ]
}
```

**Envelope:**
- `m` *(integer, required)* — mannequin ID (1 atau 2).
- `r` *(array, required, non-empty)* — array of reading tuples.

**Tuple shape (4 elements, urutan fix):**
```
[locationId, sensorNumber, sensorTypeId, value]
```
- `locationId` *(int 1–9)* — lihat tabel Locations.
- `sensorNumber` *(int)* — 1 sampai max point per lokasi.
- `sensorTypeId` *(int 1–5)* — lihat tabel Hardware Sensors. **Wajib match group lokasi** (lokasi Group A hanya boleh type 1–3, Group B hanya 4–5).
- `value` *(number, finite)* — nilai sensor.

**Aturan tambahan:**
- Boleh kirim hanya sensor yang aktif/berubah — `r` tidak perlu berisi semua sensor di lokasi tertentu.
- Boleh multi-lokasi dalam satu paket (campur Group A & B oke selama tuple consistency benar).
- Query param `?mid=` opsional. **Kalau ada, harus sama dengan `m`** di payload (kalau beda → 400 mismatch).

### Contoh — multi-location dalam satu paket
```json
{
  "m": 2,
  "r": [
    [3, 1, 1, 30.5],
    [3, 1, 2, 45.2],
    [6, 1, 4, 95000],
    [6, 1, 5, 15000]
  ]
}
```

---

## Migrasi dari Format B → Format C

Side-by-side, supaya gampang konversi firmware:

| Format B (lama, ditolak) | Format C (baru) |
|--------------------------|-----------------|
| `"location": "right_arm"` | `1` (di posisi pertama tuple) |
| `"sensorNumber": 1` | `1` (di posisi kedua tuple) |
| `"temperature": 36.5` | `[1, 1, 1, 36.5]` |
| `"pressure": 45.2` | `[1, 1, 2, 45.2]` |
| `"vibration": 1.2` | `[1, 1, 3, 1.2]` |
| `?mid=1` di URL | `"m": 1` di body |

Format B yang lama:
```json
{ "location": "right_arm", "sensorNumber": 1, "temperature": 36.5, "pressure": 45.2, "vibration": 1.2 }
```
↓ jadi Format C:
```json
{ "m": 1, "r": [[1, 1, 1, 36.5], [1, 1, 2, 45.2], [1, 1, 3, 1.2]] }
```

---

## Contoh TTS Decoder (`decodeUplink`) — Format C

Paste fungsi ini di TTS console → Application → Payload Formatters → Uplink. Wire layout di bawah cuma contoh; sesuaikan dengan firmware aktual.

```javascript
function decodeUplink(input) {
  var bytes = input.bytes;

  function getInt16(b, i) {
    var v = (b[i] << 8) | b[i + 1];
    return v & 0x8000 ? v - 0x10000 : v;
  }

  // Contoh wire layout:
  //   [0]      mannequin ID            (1 atau 2)
  //   [1]      jumlah readings (N)
  //   [2..]    per reading (5 bytes):  locId(1) sensorNumber(1) sensorTypeId(1) value×100(int16 BE, 2 bytes)
  var m = bytes[0];
  var n = bytes[1];
  var r = [];
  for (var i = 0; i < n; i++) {
    var off = 2 + i * 5;
    var locId = bytes[off];
    var sNum  = bytes[off + 1];
    var tId   = bytes[off + 2];
    var val   = getInt16(bytes, off + 3) / 100.0;
    r.push([locId, sNum, tId, val]);
  }

  return {
    data: { m: m, r: r },
    warnings: [],
    errors: [],
  };
}
```

> **Catatan**: scale factor `/100` cocok untuk temperature/pressure/vibration. Untuk `flex` (sampai 125kΩ) dan `strain` (sampai 20k µε), pakai int24/int32 + scale factor yang sesuai. Sepakat sama tim hardware soal byte layout final.

---

## Endpoint

```
POST http://localhost:3000/lora
POST http://localhost:3000/lora?mid=1   # optional cross-check
```

- `mid` di payload (`m`) **wajib**.
- `?mid=` di URL **opsional**; kalau ada harus sama dengan `m` di payload.

**Response sukses:**
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

**Contoh response 400:**
| Kondisi | Pesan |
|---------|-------|
| `m` hilang/invalid | `Missing or invalid "m" (mannequin ID required in payload, integer >= 1)` |
| `?mid=` ≠ `m` | `Mannequin mismatch: payload m=1 vs query mid=2` |
| `r` kosong/bukan array | `"r" must be a non-empty tuple array` |
| Tuple bukan 4 elemen | `r[0]: expected [locationId, sensorNumber, sensorTypeId, value]` |
| Location ID tidak dikenal | `r[0]: unknown locationId 99` |
| sensorNumber out of range | `r[0]: sensorNumber 3 out of range 1..2 for right_arm` |
| Group salah (mis. lengan + flex) | `r[0]: location right_arm does not support sensor type flex` |

---

## Health Check Endpoint

Endpoint ini buat tim hardware (atau monitoring tool) ngecek apakah LoRa node lagi aktif ngirim data ke backend, tanpa harus akses DB.

```
GET /lora/health           → status semua manekin (1 & 2)
GET /lora/health?mid=1     → status manekin 1 saja
GET /lora/health?mid=2     → status manekin 2 saja
```

**Logika status** (berdasarkan timestamp reading terakhir per manekin):

| Status | Kondisi |
|--------|---------|
| `online` | last reading ≤ 60 detik lalu |
| `stale` | 60 – 300 detik lalu |
| `offline` | > 300 detik atau belum ada data sama sekali |

**Response — all (no mid):**
```json
{
  "mannequins": [
    { "mannequinId": 1, "lastSeen": "2026-05-19T03:59:12.000Z", "secondsAgo": 8,    "status": "online" },
    { "mannequinId": 2, "lastSeen": null,                        "secondsAgo": null, "status": "offline" }
  ]
}
```

**Response — single (`?mid=1`):**
```json
{
  "mannequinId": 1,
  "lastSeen": "2026-05-19T03:59:12.000Z",
  "secondsAgo": 8,
  "status": "online"
}
```

**Threshold tuning:** ubah konstanta `ONLINE_THRESHOLD_S` / `STALE_THRESHOLD_S` di `lora.service.ts` kalo butuh sensitivity lain (misal real-time monitoring → online = 10s).

---

## File yang Relevan

| File | Fungsi |
|------|--------|
| `backend-sensor/src/lora/lora-codes.ts` | ID mapping (location & sensor type) — source of truth wire protocol |
| `backend-sensor/src/lora/lora.service.ts` | Core parser Format C, diagnostics, `getHealth()` |
| `backend-sensor/src/lora/lora.controller.ts` | `POST /lora`, `GET /lora/health`, `GET /lora/diagnostics` |
| `backend-sensor/src/sensor-reading/sensor-reading.service.ts` | `batchCreate()` + `getLastSeenByMannequin()` |
| `backend-sensor/src/cache/sensor-cache.service.ts` | Cache sensor lookup (zero DB query per request) |

---

**Last updated**: 2026-05-19 (Format C migration)
