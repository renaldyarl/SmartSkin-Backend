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

    const sensorTypes = [
      { name: 'humidity', unit: '°C' },
      { name: 'pressure', unit: 'kPa' },
      { name: 'vibration', unit: 'g' },
    ];

    const savedSensorTypes: SensorType[] = [];
    for (const type of sensorTypes) {
      let existing = await this.sensorTypeRepo.findOne({ where: { name: type.name } });
      if (!existing) {
        existing = await this.sensorTypeRepo.save(type);
      }
      savedSensorTypes.push(existing);
    }

    for (const loc of savedLocations) {
      for (const type of savedSensorTypes) {
        for (let sensorNumber = 1; sensorNumber <= 2; sensorNumber++) {
          const existing = await this.sensorRepo.findOne({
            where: {
              location: { id: loc.id },
              sensorType: { id: type.id },
              externalId: sensorNumber, 
            },
          });

          if (!existing) {
            await this.sensorRepo.save({
              location: loc,
              sensorType: type,
              externalId: sensorNumber, 
            });
          }
        }
      }
    }

    console.log('✅ Seeder: 5 locations, 3 sensor types, 30 sensors created!');
  }
}