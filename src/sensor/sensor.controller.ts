import { Controller, Get, Post, Body, Param, Delete } from '@nestjs/common';
import { SensorService } from './sensor.service';
import { CreateSensorDto } from '../dto/create-sensor.dto';

@Controller('sensor')
export class SensorController {
  constructor(private readonly sensorService: SensorService) {}

  @Post()
  create(@Body() dto: CreateSensorDto) {
    return this.sensorService.create(dto);
  }

  @Get()
  findAll() {
    return this.sensorService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sensorService.findOne(Number(id));
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.sensorService.delete(Number(id));
  }
}
