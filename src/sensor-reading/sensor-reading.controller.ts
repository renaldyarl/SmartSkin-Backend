import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { SensorReadingService } from './sensor-reading.service';
import { CreateSensorReadingDto } from '../dto/create-sensor-reading.dto';

@Controller('sensor-readings')
export class SensorReadingController {
  constructor(private readonly readingService: SensorReadingService) {}

  @Post()
  async create(@Body() dto: CreateSensorReadingDto) {
    return await this.readingService.create(dto);
  }

  @Get()
  async findAll() {
    return await this.readingService.findAll();
  }

  @Get(':sensorId/latest')
  async getLatest(
    @Param('sensorId') sensorId: number,
    @Query('limit') limit: number,
  ) {
    return await this.readingService.getLatest(sensorId, limit);
  }

  @Get(':sensorId/chart')
  async getChart(
    @Param('sensorId') sensorId: number,
    @Query('minutes') minutes: number,
  ) {
    return await this.readingService.getChartData(sensorId, minutes);
  }
}
