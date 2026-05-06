import { Injectable, BadRequestException } from '@nestjs/common';
import { SensorReadingService } from '../sensor-reading/sensor-reading.service';
import { BatchCreateSensorReadingDto } from '../dto/batch-create-sensor-reading.dto';

// Valid locations and their max sensor point count (matches seeder)
const LOCATION_MAX_POINTS: Record<string, number> = {
  right_arm: 2,
  left_arm:  2,
  back:      4,
  right_leg: 3,
  left_leg:  3,
};

const VALID_SENSOR_TYPES = ['temperature', 'pressure', 'vibration'] as const;

@Injectable()
export class LoraService {
  constructor(
    private readonly sensorReadingService: SensorReadingService,
  ) {}

  // Payload format (decoded_payload after TTN / Chirpstack unwrap):
  //
  // {
  //   "location":     "right_arm",  // right_arm | left_arm | back | right_leg | left_leg
  //   "sensorNumber": 1,            // 1 – max points for that location
  //   "temperature":  36.5,         // optional — omit if sensor not present
  //   "pressure":     101.3,        // optional
  //   "vibration":    0.05          // optional
  // }
  //
  // At least one of temperature / pressure / vibration must be provided.
  // One LoRa packet = one sensor point → creates up to 3 sensor_reading rows.
  // Query param ?mid=1|2 selects which mannequin receives the data (default 1).
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

    const readings: Array<{ sensorType: string; sensorNumber: number; value: number; location: string }> = [];

    for (const sensorType of VALID_SENSOR_TYPES) {
      if (payload[sensorType] != null) {
        readings.push({
          sensorType,
          location,       // batchCreate converts underscore → space internally
          sensorNumber: pointNum,
          value: Number(payload[sensorType]),
        });
      }
    }

    if (readings.length === 0) {
      throw new BadRequestException(
        'Payload must contain at least one of: temperature, pressure, vibration',
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

  // Supports TTN and Chirpstack uplink body formats
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
