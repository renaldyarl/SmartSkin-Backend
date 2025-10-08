import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SensorReading } from './sensor.entity';

@Injectable()
export class SensorService {
  constructor(
    @InjectRepository(SensorReading)
    private readonly sensorRepository: Repository<SensorReading>,
  ) {}

  // Ambil semua data sensor
  async findAll(): Promise<SensorReading[]> {
    return this.sensorRepository.find({
      order: { timestamp: 'DESC' }, // urut dari terbaru
    });
  }

  // Simpan data sensor baru (kalau nanti mau dari hardware)
  async create(data: Partial<SensorReading>): Promise<SensorReading> {
    const newData = this.sensorRepository.create(data);
    return this.sensorRepository.save(newData);
  }
}
