import { Injectable, BadRequestException } from '@nestjs/common';
import { SensorReadingService } from '../sensor-reading/sensor-reading.service';
import { BatchCreateSensorReadingDto } from '../dto/batch-create-sensor-reading.dto';

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
  constructor(
    private readonly sensorReadingService: SensorReadingService,
  ) {}

  async processPayload(body: any, mid: number) {
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

    return {
      status: 'ok',
      message: 'success to store lora data',
      data: result,
    };
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
