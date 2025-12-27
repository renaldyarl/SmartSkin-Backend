import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sensor } from '../sensor/sensor.entity';
import { CreateSensorDto } from '../dto/create-sensor.dto';
import { SensorType } from '../sensor/sensor-type.entity';
import { Location } from '../location/location.entity';

@Injectable()
export class SensorService {
  constructor(
    @InjectRepository(Sensor)
    private sensorRepository: Repository<Sensor>,
    @InjectRepository(SensorType)
    private sensorTypeRepository: Repository<SensorType>,
    @InjectRepository(Location)
    private locationRepository: Repository<Location>,
  ) {}

  async create(createDto: CreateSensorDto): Promise<Sensor> {
    const sensorType = await this.sensorTypeRepository.findOne({
      where: { id: createDto.sensorTypeId },
    });
    if (!sensorType) throw new NotFoundException('SensorType not found');

    const location = await this.locationRepository.findOne({
      where: { id: createDto.locationId },
    });
    if (!location) throw new NotFoundException('Location not found');

    const sensor = this.sensorRepository.create({
      externalId: createDto.externalId,
      sensorType: sensorType,
      location: location,
    });

    return this.sensorRepository.save(sensor);
  }

  findAll() {
    return this.sensorRepository.find({ relations: ['sensorType', 'location'] });
  }
}