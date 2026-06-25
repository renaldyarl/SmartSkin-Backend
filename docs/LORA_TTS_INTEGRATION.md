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

## Wire Layout Firmware Aktual (`skin_ide/skin_putih.ino`)

Source firmware: `skin_ide/skin_putih.ino`, fungsi `sendLoRaSkinUplink()` (`:515`), TX call di `node.sendReceive(payload, idx, 1)` (`:664`) — FPort 1.

**Payload: 3–11 bytes, big-endian, variable length berdasarkan mask byte.**

```
byte[0] = locationIndex   0..8   ⚠ ZERO-BASED — decoder WAJIB +1 untuk Format C (1..9)
byte[1] = sensorNumber    1..N   (1-based, sesuai Format C)
byte[2] = mask byte:
            0x01 = temperature  → int16  BE, value × 100         (2 bytes)
            0x02 = pressure     → uint16 BE, value × 10          (2 bytes)
            0x04 = vibration    → uint16 BE, value × 1000        (2 bytes)
            0x08 = flex         → uint32 BE, raw Ω (no scale)    (4 bytes)
            0x10 = strain       → uint32 BE, raw µε (no scale)   (4 bytes)
byte[3..N] = field bytes, urutan = mask bit LSB → MSB
```

**Group A** (locationIndex 0..4 = arm/back/leg): emit bit 0/1/2 → temp + pressure + vibration
**Group B** (locationIndex 5..8 = elbow/knee): emit bit 3/4 → flex + strain

**⚠ Quirk (skin_putih.ino:542–545)**: kalau `pressureN > 0` ATAU `vibVolt > 0`, firmware set mask `0x02 | 0x04` **bareng**. Akibatnya decoder kadang dapat field `pressure=0` atau `vibration=0` yang valid (no contact / no vibration). **Decoder emit dua-duanya** — backend accept 0 sebagai finite reading.

### DevEUI → Mannequin ID mapping

| DevEUI | Mannequin ID (`m` di Format C) | Source firmware |
|--------|--------------------------------|-----------------|
| `AD8121DAD12451E1` | **2** | `skin_ide/skin_putih.ino:40` |
| `TBD` | 1 | (firmware mannequin 1 belum di-audit) |

---

## TTS Decoder (`decodeUplink`) — match firmware aktual

Paste di TTS Console → Application → Payload Formatters → Uplink. Decoder ini match wire layout di atas (verified per audit 2026-05-19).

```javascript
function decodeUplink(input) {
  var bytes = input.bytes;

  // DevEUI → mannequin ID (uppercase hex, no separators)
  var EUI_TO_MANNEQUIN = {
    'AD8121DAD12451E1': 2,
    // 'XXXXXXXXXXXXXXXX': 1,  // mannequin 1 — TBD setelah audit firmware-nya
  };

  function u16(b, i) { return (b[i] << 8) | b[i + 1]; }
  function i16(b, i) { var v = u16(b, i); return v & 0x8000 ? v - 0x10000 : v; }
  function u32(b, i) {
    // Hindari bitshift di byte 0 karena JS bitwise ops 32-bit signed.
    return (b[i] * 0x1000000) + ((b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]);
  }

  if (bytes.length < 3) {
    return { data: null, warnings: [], errors: ['Payload too short (<3 bytes)'] };
  }

  var locationId = bytes[0] + 1;   // 0-based firmware → 1-based Format C
  var sensorNum  = bytes[1];
  var mask       = bytes[2];
  var off = 3;
  var r = [];

  // Urutan field: LSB → MSB sesuai builder firmware (skin_putih.ino:560–607)
  if (mask & 0x01) { r.push([locationId, sensorNum, 1, i16(bytes, off) / 100.0]);   off += 2; }
  if (mask & 0x02) { r.push([locationId, sensorNum, 2, u16(bytes, off) / 10.0]);    off += 2; }
  if (mask & 0x04) { r.push([locationId, sensorNum, 3, u16(bytes, off) / 1000.0]);  off += 2; }
  if (mask & 0x08) { r.push([locationId, sensorNum, 4, u32(bytes, off)]);           off += 4; }
  if (mask & 0x10) { r.push([locationId, sensorNum, 5, u32(bytes, off)]);           off += 4; }

  // DevEUI lookup — verify field name di TTS console (bisa input.metadata.dev_eui
  // atau input.end_device_ids.dev_eui tergantung versi TTS).
  var eui = '';
  if (input.metadata && input.metadata.dev_eui) eui = input.metadata.dev_eui;
  else if (input.end_device_ids && input.end_device_ids.dev_eui) eui = input.end_device_ids.dev_eui;

  var m = EUI_TO_MANNEQUIN[eui.toUpperCase()];
  if (!m) {
    return { data: null, warnings: [], errors: ['Unknown DevEUI: ' + eui] };
  }

  return {
    data: { m: m, r: r },
    warnings: [],
    errors: [],
  };
}
```

> **Catatan deploy**: kalau API `input.metadata.dev_eui` / `input.end_device_ids.dev_eui` tidak available di TTS version yang lo pakai, alternatif: deploy decoder **per-device** di TTS (override payload formatter per end-device) dan hardcode `var m = 2;` di decoder mannequin 2.

### Sanity check via TTS Payload Formatter "Test"

Input hex (Group A, back, sensor 1, temp=30.5°C, pressure=45.2N, vibration=1.2V):
```
02 01 07 0B EE 01 C4 04 B0
```
Expected decoded output:
```json
{ "m": 2, "r": [[3,1,1,30.5],[3,1,2,45.2],[3,1,3,1.2]] }
```

Input hex (Group B, right_elbow, sensor 1, flex=95000Ω, strain=15000µε):
```
05 01 18 00 01 73 18 00 00 3A 98
```
Expected decoded output:
```json
{ "m": 2, "r": [[6,1,4,95000],[6,1,5,15000]] }
```

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
