import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SensorReadingService } from '../sensor-reading/sensor-reading.service';
import { BatchCreateSensorReadingDto } from '../dto/batch-create-sensor-reading.dto';

interface PacketTrace {
  mid: number;
  receivedAt: Date | null;   // TTS-reported uplink time (when gateway saw the packet)
  arrivedAt: Date;            // server now() when /lora handler ran
  ttsToBeMs: number | null;   // arrivedAt - receivedAt
}

// Matches seeder: Group A (5 old locations) + Group B (4 new locations)
const LOCATION_MAX_POINTS: Record<string, number> = {
  right_arm:    2,
  left_arm:     2,
  back:         4,
  right_leg:    3,
  left_leg:     3,
  right_elbow:  1,
  left_elbow:   1,
  right_knee:   1,
  left_knee:    1,
};

// All 5 sensor types seeded in DB
const ALL_SENSOR_TYPES = ['temperature', 'pressure', 'vibration', 'flex', 'strain'] as const;

// ─── Payload formats accepted by POST /lora ───────────────────────────────────
//
// TTS wraps decoded_payload automatically. Both formats below land in
// uplink_message.decoded_payload after extractPayload() unwraps the envelope.
//
// FORMAT A — Grouped (hardware-named keys, recommended for new firmware):
//
//   Group A locations (right_arm | left_arm | back | right_leg | left_leg):
//   {
//     "location":     "right_arm",   // underscore, see LOCATION_MAX_POINTS
//     "sensorNumber": 1,             // 1 – max for that location
//     "mcp9808":    { "temperature": 36.5  },   // MCP9808  — °C  (max 50, danger ≥38)
//     "fsr":        { "pressure":    45.2  },   // FSR      — N   (max 98.07, danger 45–70)
//     "piezo":      { "vibration":   1.2   }    // Piezo    — V   (max 3)
//   }
//
//   Group B locations (right_elbow | left_elbow | right_knee | left_knee):
//   {
//     "location":     "right_elbow",
//     "sensorNumber": 1,
//     "flexSensor":   { "flex":   95000.0 },    // Flex     — Ω   (max 125kΩ, danger 95k–105k)
//     "strainGauge":  { "strain": 15000.0 }     // Strain   — µε  (max 20000, danger 12k–20k)
//   }
//
// FORMAT B — Flat (legacy, kept for backward compatibility):
//   {
//     "location":     "right_arm",
//     "sensorNumber": 1,
//     "temperature":  36.5,
//     "pressure":     45.2,
//     "vibration":    1.2
//   }
//
// All sensor fields are optional — at least one must be present.
// One LoRa packet = one sensor point → up to N sensor_reading rows.
// Query param ?mid=1|2 selects the mannequin (default 1).
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class LoraService {
  private readonly logger = new Logger(LoraService.name);

  // Ring buffer of recent packets — used by GET /lora/diagnostics to prove
  // where time is going (TTS→BE transit vs inter-packet sampling gap).
  // In-memory only; resets on app restart.
  private static readonly TRACE_BUFFER_SIZE = 100;
  private static readonly HIGH_LATENCY_WARN_MS = 5000;
  private readonly traces: PacketTrace[] = [];

  constructor(
    private readonly sensorReadingService: SensorReadingService,
  ) {}

  async processPayload(body: any, mid: number) {
    const receivedAt = this.extractReceivedAt(body);
    const payload = this.extractPayload(body);
    if (!payload) {
      throw new BadRequestException('Empty or unrecognized payload format');
    }

    const { location, sensorNumber } = payload;

    if (!location || !LOCATION_MAX_POINTS[location]) {
      throw new BadRequestException(
        `Invalid or missing "location". Valid values: ${Object.keys(LOCATION_MAX_POINTS).join(', ')}`,
      );
    }

    const maxPoints = LOCATION_MAX_POINTS[location];
    const pointNum = Number(sensorNumber);

    if (!Number.isInteger(pointNum) || pointNum < 1 || pointNum > maxPoints) {
      throw new BadRequestException(
        `Invalid "sensorNumber" for location "${location}". Must be 1–${maxPoints}`,
      );
    }

    const readings: Array<{
      sensorType: string;
      sensorNumber: number;
      value: number;
      location: string;
    }> = [];

    const push = (sensorType: string, raw: unknown) => {
      const val = Number(raw);
      if (raw != null && !isNaN(val)) {
        readings.push({ sensorType, location, sensorNumber: pointNum, value: val });
      }
    };

    // ── Format A: grouped (hardware-named keys) ──────────────────────────────
    if (
      payload.mcp9808   != null || payload.fsr       != null ||
      payload.piezo     != null || payload.flexSensor != null ||
      payload.strainGauge != null
    ) {
      push('temperature', payload.mcp9808?.temperature);
      push('pressure',    payload.fsr?.pressure);
      push('vibration',   payload.piezo?.vibration);
      push('flex',        payload.flexSensor?.flex);
      push('strain',      payload.strainGauge?.strain);

    // ── Format B: flat (legacy) ───────────────────────────────────────────────
    } else {
      for (const sensorType of ALL_SENSOR_TYPES) {
        push(sensorType, payload[sensorType]);
      }
    }

    if (readings.length === 0) {
      throw new BadRequestException(
        'Payload must contain at least one sensor value. ' +
        'Grouped: mcp9808.temperature, fsr.pressure, piezo.vibration, flexSensor.flex, strainGauge.strain. ' +
        'Flat: temperature, pressure, vibration, flex, strain.',
      );
    }

    const dto = Object.assign(new BatchCreateSensorReadingDto(), { readings, mannequinId: mid });
    const result = await this.sensorReadingService.batchCreate(dto);

    this.recordTrace(mid, receivedAt);

    return {
      status: 'ok',
      message: 'success to store lora data',
      data: result,
    };
  }

  private recordTrace(mid: number, receivedAt: Date | null) {
    const arrivedAt = new Date();
    const ttsToBeMs = receivedAt ? arrivedAt.getTime() - receivedAt.getTime() : null;

    this.traces.push({ mid, receivedAt, arrivedAt, ttsToBeMs });
    if (this.traces.length > LoraService.TRACE_BUFFER_SIZE) {
      this.traces.shift();
    }

    if (ttsToBeMs != null && ttsToBeMs > LoraService.HIGH_LATENCY_WARN_MS) {
      this.logger.warn(
        `High TTS→BE latency: ${ttsToBeMs}ms (mid=${mid}, received_at=${receivedAt?.toISOString()})`,
      );
    }
  }

  private extractReceivedAt(body: any): Date | null {
    const raw =
      body?.uplink_message?.received_at ??
      body?.object?.uplink_message?.received_at ??
      body?.received_at ??
      null;
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }

  private percentile(sortedAsc: number[], p: number): number {
    if (sortedAsc.length === 0) return 0;
    const idx = Math.min(sortedAsc.length - 1, Math.floor(sortedAsc.length * p));
    return sortedAsc[idx];
  }

  // GET /lora/diagnostics — returns stats from the in-memory trace buffer.
  // Use this to prove whether delay lives in TTS→BE transit (latencyMs) or
  // in the hardware sampling gap (interArrivalMs).
  getDiagnostics(mid?: number) {
    const filtered = mid != null ? this.traces.filter((t) => t.mid === mid) : this.traces;

    if (filtered.length === 0) {
      return {
        mannequinId: mid ?? 'all',
        packetCount: 0,
        bufferCapacity: LoraService.TRACE_BUFFER_SIZE,
        ttsToBeLatency: null,
        interArrival: null,
        recent: [],
        note: 'No packets traced yet. Send LoRa data first, then re-query.',
      };
    }

    const latencies = filtered
      .map((t) => t.ttsToBeMs)
      .filter((v): v is number => v != null)
      .sort((a, b) => a - b);

    const arrivals = filtered.map((t) => t.arrivedAt.getTime()).sort((a, b) => a - b);
    const deltas: number[] = [];
    for (let i = 1; i < arrivals.length; i++) {
      deltas.push(arrivals[i] - arrivals[i - 1]);
    }
    deltas.sort((a, b) => a - b);

    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
    const stats = (xs: number[]) => ({
      sampleCount: xs.length,
      minMs: xs[0],
      p50Ms: this.percentile(xs, 0.5),
      p95Ms: this.percentile(xs, 0.95),
      maxMs: xs[xs.length - 1],
      avgMs: Math.round(sum(xs) / xs.length),
    });

    return {
      mannequinId: mid ?? 'all',
      packetCount: filtered.length,
      bufferCapacity: LoraService.TRACE_BUFFER_SIZE,
      ttsToBeLatency: latencies.length > 0 ? stats(latencies) : null,
      interArrival: deltas.length > 0 ? stats(deltas) : null,
      recent: filtered.slice(-10).map((t) => ({
        mid: t.mid,
        receivedAt: t.receivedAt,
        arrivedAt: t.arrivedAt,
        ttsToBeMs: t.ttsToBeMs,
      })),
    };
  }

  // Online if last reading within 60s, stale within 5 min, offline beyond that.
  private static readonly ONLINE_THRESHOLD_S = 60;
  private static readonly STALE_THRESHOLD_S  = 300;

  async getHealth(mid?: number) {
    const targets = mid != null ? [mid] : [1, 2];
    const now = Date.now();

    const items = await Promise.all(
      targets.map(async (mannequinId) => {
        const lastSeen = await this.sensorReadingService.getLastSeenByMannequin(mannequinId);
        const secondsAgo = lastSeen ? Math.floor((now - lastSeen.getTime()) / 1000) : null;

        let status: 'online' | 'stale' | 'offline';
        if (secondsAgo == null) status = 'offline';
        else if (secondsAgo <= LoraService.ONLINE_THRESHOLD_S) status = 'online';
        else if (secondsAgo <= LoraService.STALE_THRESHOLD_S) status = 'stale';
        else status = 'offline';

        return { mannequinId, lastSeen, secondsAgo, status };
      }),
    );

    return mid != null ? items[0] : { mannequins: items };
  }

  // Supports TTS (The Things Stack) and Chirpstack uplink body formats
  private extractPayload(body: any): any {
    return (
      body?.uplink_message?.decoded_payload ??
      body?.object?.uplink_message?.decoded_payload ??
      body?.decoded_payload ??
      body?.object ??
      null
    );
  }
}
