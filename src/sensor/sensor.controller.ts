import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { SensorService } from './sensor.service';
import { CreateSensorReadingDto } from './dto/create-sensor-reading.dto';
import { PaginateQueryDto } from './dto/paginate-query.dto';

@Controller('sensor')
export class SensorController {
  constructor(private readonly sensorService: SensorService) {}

  @Get()
  async getAll() {
    return this.sensorService.findAll(); // contoh endpoint GET /sensor
  }
  
  // POST /sensor
  @Post()
  @UsePipes(new ValidationPipe({ transform: true }))
  create(@Body() dto: CreateSensorReadingDto) {
    return this.sensorService.create(dto);
  }

  // GET /sensor/latest?sensor_id=xxx
  @Get('latest')
  @UsePipes(new ValidationPipe({ transform: true }))
  getLatest(@Query('sensor_id') sensor_id?: number) {
    return this.sensorService.getLatestData(sensor_id);
  }

  // GET /sensor/latest/paginate?page=1&limit=10&sensor_id=xxx
  @Get('latest/paginate')
  @UsePipes(new ValidationPipe({ transform: true }))
  getLatestPaginate(@Query() q: PaginateQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 10;
    const sensor_id = q.sensor_id;
    return this.sensorService.getLatestDataPaginate(page, limit, sensor_id);
  }
}
