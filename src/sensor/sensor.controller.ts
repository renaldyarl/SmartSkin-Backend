import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Patch,
  Delete,
} from '@nestjs/common';
import { SensorService } from './sensor.service';
import { SensorReading } from './sensor.entity';

@Controller('sensor')
export class SensorController {
  constructor(private readonly sensorService: SensorService) {}

  @Get()
  async getAll(): Promise<SensorReading[]> {
    return this.sensorService.findAll();
  }

  @Post()
  async addSensorData(@Body() body: Partial<SensorReading>) {
    return this.sensorService.create(body);
  }
}
