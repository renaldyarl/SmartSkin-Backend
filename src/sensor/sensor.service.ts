import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sensor } from './sensor.entity';
import { CreateSensorDto } from '../dto/create-sensor.dto';

@Injectable()
export class SensorService {
  constructor(
    @InjectRepository(Sensor)
    private readonly sensorRepo: Repository<Sensor>,
  ) {}

  async create(dto: CreateSensorDto) {
    const sensor = this.sensorRepo.create({
      sensorType: { id: dto.sensorTypeId },
      location: { id: dto.locationId },
    });

    return this.sensorRepo.save(sensor);
  }

  async findAll() {
    return await this.sensorRepo.find({
      relations: ['sensorType', 'location', 'readings'],
    });
  }

  async findOne(id: number) {
    return await this.sensorRepo.findOne({
      where: { id },
      relations: ['sensorType', 'location', 'readings'],
    });
  }

  async delete(id: number) {
    await this.sensorRepo.delete(id);
    return { message: 'Sensor deleted' };
  }
}
