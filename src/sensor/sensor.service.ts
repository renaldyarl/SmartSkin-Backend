import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SensorReading } from './sensor.entity';
import { CreateSensorReadingDto } from './dto/create-sensor-reading.dto';

@Injectable()
export class SensorService {
  constructor(
    @InjectRepository(SensorReading)
    private readonly repo: Repository<SensorReading>,
  ) {}

    async findAll(): Promise<SensorReading[]> {
    return this.repo.find({
      order: { createdAt: 'DESC' }, // urut dari terbaru
    });
  }

  // create new reading
  async create(dto: CreateSensorReadingDto): Promise<SensorReading> {
    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }

  // get single latest reading (optionally by sensor_id)
  async getLatestData(sensor_id?: number) {
    const where = sensor_id ? { sensor_id } : {};
    const items = await this.repo.find({
      where,
      order: { createdAt: 'DESC' },
      take: 1,
    });

    const latest = items[0] ?? null;

    return {
      status: 'success',
      message: sensor_id
        ? `Latest data for sensor_id=${sensor_id}`
        : 'Latest data',
      data: latest,
    };
  }

  // get paginated latest readings (optionally filter by sensor_id)
  async getLatestDataPaginate(page = 1, limit = 10, sensor_id?: number) {
    const where = sensor_id ? { sensor_id } : {};
    const [data, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      status: 'success',
      message: sensor_id
        ? `Paginated data for sensor_id=${sensor_id}`
        : 'Paginated latest data',
      page,
      limit,
      total,
      data,
    };
  }
}
