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
import { PaginateSensorReadingQueryDto } from '../dto/paginate-sensor-reading-query.dto';

@Controller('sensor-reading')
export class SensorReadingController {
  constructor(private readonly sensorReadingService: SensorReadingService) {}

  @Post()
  @UsePipes(new ValidationPipe({ transform: true }))
  create(@Body() dto: CreateSensorReadingDto) {
    return this.sensorReadingService.create(dto);
  }

  @Get()
  findAll() {
    return this.sensorReadingService.findAll();
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