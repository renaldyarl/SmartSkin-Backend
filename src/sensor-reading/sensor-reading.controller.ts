import { Controller, Post, Get, Body, UsePipes, ValidationPipe } from '@nestjs/common';
import { SensorReadingService } from './sensor-reading.service';
import { CreateSensorReadingDto } from '../dto/create-sensor-reading.dto';

@Controller('sensor-reading')
export class SensorReadingController {
  constructor(private readonly sensorReadingService: SensorReadingService) {}

  @Post()
  @UsePipes(new ValidationPipe())
  create(@Body() createDto: CreateSensorReadingDto) {
    return this.sensorReadingService.create(createDto);
  }

  @Get()
  findAll() {
    return this.sensorReadingService.findAll();
  }
}