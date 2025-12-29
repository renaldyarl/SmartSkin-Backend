import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SensorReading } from './sensor-reading.entity';
import { CreateSensorReadingDto } from '../dto/create-sensor-reading.dto';
import { Sensor } from '../sensor/sensor.entity';
import { Location } from '../location/location.entity';
import { SensorType } from '../sensor/sensor-type.entity';

@Injectable()
export class SensorReadingService {
  constructor(
    @InjectRepository(SensorReading)
    private sensorReadingRepository: Repository<SensorReading>,
    @InjectRepository(Sensor)
    private sensorRepository: Repository<Sensor>,
    @InjectRepository(Location)
    private locationRepository: Repository<Location>,
    @InjectRepository(SensorType)
    private sensorTypeRepository: Repository<SensorType>,
  ) {}

  async create(dto: CreateSensorReadingDto): Promise<SensorReading> {
    // Normalisasi lokasi: "right_arm" → "right arm"
    const locationName = dto.location.replace(/_/g, ' ');
    const sensorTypeName = dto.sensorType;
    const sensorNumber = dto.sensorNumber;

    // Cari lokasi & tipe sensor
    const [location, sensorType] = await Promise.all([
      this.locationRepository.findOne({ where: { name: locationName } }),
      this.sensorTypeRepository.findOne({ where: { name: sensorTypeName } }),
    ]);

    if (!location) {
      throw new NotFoundException(`Location "${dto.location}" not found`);
    }
    if (!sensorType) {
      throw new NotFoundException(`Sensor type "${dto.sensorType}" not found`);
    }

    // Cari sensor BERDASARKAN: lokasi + tipe + nomor sensor
    const sensor = await this.sensorRepository.findOne({
      where: {
        location: { id: location.id },
        sensorType: { id: sensorType.id },
        externalId: sensorNumber, // 👈 Ini kuncinya!
      },
    });

    if (!sensor) {
      throw new NotFoundException(
        `Sensor not found for location "${dto.location}", type "${dto.sensorType}", and number ${sensorNumber}`,
      );
    }

    const reading = this.sensorReadingRepository.create({
      sensor,
      value: dto.value,
    });

    return this.sensorReadingRepository.save(reading);
  }

  findAll() {
    return this.sensorReadingRepository.find({
      relations: ['sensor', 'sensor.sensorType', 'sensor.location'],
    });
  }
}