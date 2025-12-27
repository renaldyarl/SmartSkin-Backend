// src/seeder/seeder.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location } from '../location/location.entity';
import { SensorType } from '../sensor/sensor-type.entity';
import { Sensor } from '../sensor/sensor.entity';

@Injectable()
export class SeederService {
  constructor(
    @InjectRepository(Location)
    private locationRepo: Repository<Location>,
    @InjectRepository(SensorType)
    private sensorTypeRepo: Repository<SensorType>,
    @InjectRepository(Sensor)
    private sensorRepo: Repository<Sensor>,
  ) {}

  async seed() {
    // 1. Seed locations
    const locations = [
      'right arm',
      'left arm',
      'back',
      'left leg',
      'right leg',
    ].map(name => ({ name }));

    const savedLocations: Location[] = []; 
    for (const loc of locations) {
      let existing = await this.locationRepo.findOne({ where: { name: loc.name } });
      if (!existing) {
        existing = await this.locationRepo.save(loc);
      }
      savedLocations.push(existing);
    }

    // 2. Seed sensor types
    const sensorTypes = [
      { name: 'friction', unit: 'N' },
      { name: 'vibration', unit: 'g' },
      { name: 'humidity', unit: '%' },
      { name: 'pressure', unit: 'kPa' },
      { name: 'stretch', unit: 'mm' },
    ];

    const savedSensorTypes: SensorType[] = [];
    for (const type of sensorTypes) {
      let existing = await this.sensorTypeRepo.findOne({ where: { name: type.name } });
      if (!existing) {
        existing = await this.sensorTypeRepo.save(type);
      }
      savedSensorTypes.push(existing);
    }

    // 3. Seed sensors: 5 lokasi × 5 jenis = 25 sensor
    for (const loc of savedLocations) {
      for (const type of savedSensorTypes) {
        const existing = await this.sensorRepo.findOne({
          where: {
            location: { id: loc.id },
            sensorType: { id: type.id },
          },
        });
        if (!existing) {
          await this.sensorRepo.save({
            location: loc,
            sensorType: type,
            externalId: type.id,
          });
        }
      }
    }

    console.log('✅ Seeder: 5 locations, 5 sensor types, 25 sensors created!');
  }
}