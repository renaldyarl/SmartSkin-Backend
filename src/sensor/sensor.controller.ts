// src/sensor/sensor.controller.ts
import { Controller, Post, Get, Body, UsePipes, ValidationPipe } from '@nestjs/common';
import { SensorService } from './sensor.service';
import { CreateSensorDto } from '../dto/create-sensor.dto';

@Controller('sensor')
export class SensorController {
  constructor(private readonly sensorService: SensorService) {}

  @Post()
  @UsePipes(new ValidationPipe())
  create(@Body() createDto: CreateSensorDto) {
    return this.sensorService.create(createDto);
  }

  @Get()
  findAll() {
    return this.sensorService.findAll();
  }
}