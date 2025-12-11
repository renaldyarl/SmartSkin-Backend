import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SensorReading } from './sensor-reading.entity';
import { CreateSensorReadingDto } from '../dto/create-sensor-reading.dto';

@Injectable()
export class SensorReadingService {
  constructor(
    @InjectRepository(SensorReading)
    private readonly readingRepo: Repository<SensorReading>,
  ) {}
  
  async findAll() {
    return await this.readingRepo.find({
      relations: ['sensor'],
      order: { timestamp: 'DESC' },
    });
  }

  async create(dto: CreateSensorReadingDto) {
    return await this.readingRepo.save({
      sensor: { id: dto.sensorId },
      value: dto.value,
      timestamp: new Date(),
    });
  }

  async getLatest(sensorId: number, limit = 50) {
    return await this.readingRepo.find({
      where: { sensor: { id: sensorId } },
      order: { timestamp: 'DESC' },
      take: limit,
      relations: ['sensor'],
    });
  }

  async getChartData(sensorId: number, minutes = 30) {
    return await this.readingRepo.query(
      `
      SELECT 
        value,
        timestamp
      FROM sensor_reading
      WHERE sensor_id = $1
      AND timestamp >= NOW() - INTERVAL '${minutes} minutes'
      ORDER BY timestamp ASC
    `,
      [sensorId],
    );
  }
}
