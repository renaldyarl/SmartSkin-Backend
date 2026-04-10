import {
  Controller,
  Post,
  Get,
  Body,
  UsePipes,
  ValidationPipe,
  Query,
  Param,
} from '@nestjs/common';
import { SensorReadingService } from './sensor-reading.service';
import { CreateSensorReadingDto } from '../dto/create-sensor-reading.dto';
import { BatchCreateSensorReadingDto } from '../dto/batch-create-sensor-reading.dto';
import { PaginateSensorReadingQueryDto } from '../dto/paginate-sensor-reading-query.dto';
import { SensorRealtimeStats } from '../dto/sensor-realtime-stats.dto';

@Controller('sensor-reading')
export class SensorReadingController {
  constructor(private readonly sensorReadingService: SensorReadingService) {}

  @Post('batch')
  @UsePipes(new ValidationPipe({ transform: true }))
  createBatch(@Body() dto: BatchCreateSensorReadingDto) {
    return this.sensorReadingService.batchCreate(dto);
  }

  @Post()
  @UsePipes(new ValidationPipe({ transform: true }))
  create(@Body() dto: CreateSensorReadingDto) {
    return this.sensorReadingService.create(dto);
  }

  @Get('paginated')
  @UsePipes(new ValidationPipe({ transform: true }))
  findBySensorType(@Query() query: PaginateSensorReadingQueryDto) {
    return this.sensorReadingService.findBySensorType(query);
  }

  @Get('sensor-types')
  getAvailableSensorTypes() {
    return this.sensorReadingService.getAvailableSensorTypes();
  }

  @Get('latest')
  getLatestReadings(): Promise<SensorRealtimeStats[]> {
    return this.sensorReadingService.getLatestReadingsPerSensorType();
  }

  @Get(':sensorTypeName')
  @UsePipes(new ValidationPipe({ transform: true }))
  getReadingsBySensorType(
    @Param('sensorTypeName') sensorTypeName: string,
    @Query() query: PaginateSensorReadingQueryDto,
  ) {
    return this.sensorReadingService.getReadingsBySensorType(
      sensorTypeName,
      query,
    );
  }
}