import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SensorReadingService } from '../sensor-reading/sensor-reading.service';
import { BatchCreateSensorReadingDto } from '../dto/batch-create-sensor-reading.dto';
import {
  LOCATION_BY_ID,
  SENSOR_TYPE_BY_ID,
  MAX_POINTS_BY_LOCATION_ID,
  GROUP_A_LOCATION_IDS,
  GROUP_A_TYPE_IDS,
  GROUP_B_LOCATION_IDS,
  GROUP_B_TYPE_IDS,
} from './lora-codes';

interface PacketTrace {
  mid: number;
  receivedAt: Date | null;   // TTS-reported uplink time (when gateway saw the packet)
  arrivedAt: Date;            // server now() when /lora handler ran
  ttsToBeMs: number | null;   // arrivedAt - receivedAt
}

// ─── Payload format accepted by POST /lora — Format C (Compact Tuple) ─────────
//
// TTS wraps decoded_payload automatically. extractPayload() unwraps the envelope.
//
// {
//   "m": 1,                          // mannequin ID (required in payload)
//   "r": [                           // non-empty array of reading tuples
//     [3, 1, 1, 30.5],               // [locationId, sensorNumber, sensorTypeId, value]
//     [3, 1, 2, 45.2],
//     [3, 1, 3, 1.2]
//   ]
// }
//
// ID mappings live in ./lora-codes.ts (must match seeder order).
// Query param ?mid=1|2 is optional — if present, must equal payload "m".
// ─────────────────────────────────────────────────────────────────────────────

// Legacy fields from removed Format A/B — used to emit a clear migration warning
// when straggler firmware still sends the old shape.
const LEGACY_FIELDS = [
  'location', 'sensorNumber',
  'mcp9808', 'fsr', 'piezo', 'flexSensor', 'strainGauge',
  'temperature', 'pressure', 'vibration', 'flex', 'strain',
];

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

  async processPayload(body: any, midQuery?: number) {
    const receivedAt = this.extractReceivedAt(body);
    const payload = this.extractPayload(body);
    if (!payload) {
      throw new BadRequestException('Empty or unrecognized payload format');
    }

    // Help hardware team detect straggler firmware still emitting Format A/B.
    if (LEGACY_FIELDS.some((f) => payload[f] !== undefined)) {
      this.logger.warn(
        'Legacy Format A/B payload detected — firmware/TTS decoder needs update to Format C',
      );
    }

    // --- Mannequin ID (m wajib di payload; ?mid= optional cross-check) ---
    const midBody = Number(payload.m);
    if (!Number.isInteger(midBody) || midBody < 1) {
      throw new BadRequestException(
        'Missing or invalid "m" (mannequin ID required in payload, integer >= 1)',
      );
    }
    if (midQuery != null && midQuery !== midBody) {
      throw new BadRequestException(
        `Mannequin mismatch: payload m=${midBody} vs query mid=${midQuery}`,
      );
    }
    const mid = midBody;

    // --- Validate envelope ---
    if (!Array.isArray(payload.r) || payload.r.length === 0) {
      throw new BadRequestException('"r" must be a non-empty tuple array');
    }

    const readings: Array<{
      sensorType: string;
      sensorNumber: number;
      value: number;
      location: string;
    }> = [];

    for (let i = 0; i < payload.r.length; i++) {
      const tuple = payload.r[i];
      if (!Array.isArray(tuple) || tuple.length !== 4) {
        throw new BadRequestException(
          `r[${i}]: expected [locationId, sensorNumber, sensorTypeId, value]`,
        );
      }

      const [locId, sNum, typeId, rawVal] = tuple;
      const locationName = LOCATION_BY_ID[locId as number];
      const sensorTypeName = SENSOR_TYPE_BY_ID[typeId as number];
      const maxPoints = MAX_POINTS_BY_LOCATION_ID[locId as number];

      if (!locationName) {
        throw new BadRequestException(`r[${i}]: unknown locationId ${locId}`);
      }
      if (!sensorTypeName) {
        throw new BadRequestException(`r[${i}]: unknown sensorTypeId ${typeId}`);
      }

      const sensorNumber = Number(sNum);
      if (!Number.isInteger(sensorNumber) || sensorNumber < 1 || sensorNumber > maxPoints) {
        throw new BadRequestException(
          `r[${i}]: sensorNumber ${sNum} out of range 1..${maxPoints} for ${locationName}`,
        );
      }

      const okA = GROUP_A_LOCATION_IDS.has(locId as number) && GROUP_A_TYPE_IDS.has(typeId as number);
      const okB = GROUP_B_LOCATION_IDS.has(locId as number) && GROUP_B_TYPE_IDS.has(typeId as number);
      if (!okA && !okB) {
        throw new BadRequestException(
          `r[${i}]: location ${locationName} does not support sensor type ${sensorTypeName}`,
        );
      }

      const value = Number(rawVal);
      if (!Number.isFinite(value)) {
        throw new BadRequestException(`r[${i}]: value must be a finite number`);
      }

      readings.push({ sensorType: sensorTypeName, location: locationName, sensorNumber, value });
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
