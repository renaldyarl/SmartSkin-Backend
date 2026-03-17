import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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

  async create(
    dto: CreateSensorReadingDto,
  ): Promise<{ saved: number; location: string }> {
    const locationName = dto.location.replace(/_/g, ' ');

    // 1. Ambil location — 1 query
    const location = await this.locationRepository.findOne({
      where: { name: locationName },
    });
    if (!location) {
      throw new NotFoundException(`Location "${dto.location}" not found`);
    }

    // 2. Ambil semua unique sensorType sekaligus — 1 query
    const uniqueSensorTypeNames = [
      ...new Set(dto.readings.map((r) => r.sensorType)),
    ];
    const sensorTypes = await this.sensorTypeRepository.find({
      where: { name: In(uniqueSensorTypeNames) },
    });

    const sensorTypeMap = new Map(sensorTypes.map((st) => [st.name, st]));
    for (const name of uniqueSensorTypeNames) {
      if (!sensorTypeMap.has(name)) {
        throw new NotFoundException(`Sensor type "${name}" not found`);
      }
    }

    // 3. Ambil semua sensor yang relevan — 1 query
    const sensorTypeIds = sensorTypes.map((st) => st.id);
    const sensors = await this.sensorRepository.find({
      where: {
        location: { id: location.id },
        sensorType: { id: In(sensorTypeIds) },
      },
      relations: ['sensorType'],
    });

    // Lookup map: "sensorTypeName-sensorNumber" -> Sensor
    const sensorMap = new Map(
      sensors.map((s) => [`${s.sensorType.name}-${s.externalId}`, s]),
    );

    // 4. Bangun semua reading entity
    const readingEntities = dto.readings.map((item) => {
      const key = `${item.sensorType}-${item.sensorNumber}`;
      const sensor = sensorMap.get(key);

      if (!sensor) {
        throw new NotFoundException(
          `Sensor not found for location "${dto.location}", type "${item.sensorType}", number ${item.sensorNumber}`,
        );
      }

      return this.sensorReadingRepository.create({
        sensor,
        value: item.value,
      });
    });

    // 5. Bulk insert — 1 query
    await this.sensorReadingRepository.save(readingEntities);

    return { saved: readingEntities.length, location: locationName };
  }

  findAll() {
    return this.sensorReadingRepository.find({
      relations: ['sensor', 'sensor.sensorType', 'sensor.location'],
    });
  }
}
