import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location } from '../location/location.entity';
import { SensorType } from '../sensor/sensor-type.entity';
import { Sensor } from '../sensor/sensor.entity';
import { Mannequin } from '../mannequin/mannequin.entity';

@Injectable()
export class SeederService {
  constructor(
    @InjectRepository(Location)
    private locationRepo: Repository<Location>,
    @InjectRepository(SensorType)
    private sensorTypeRepo: Repository<SensorType>,
    @InjectRepository(Sensor)
    private sensorRepo: Repository<Sensor>,
    @InjectRepository(Mannequin)
    private mannequinRepo: Repository<Mannequin>,
  ) {}

  async seed() {
    // Seed locations (shared across all mannequins)
    // Hardware sends underscores; app converts to spaces: right_arm → right arm
    const locations = [
      'right arm',
      'left arm',
      'back',
      'right leg',
      'left leg',
    ].map((name) => ({ name }));

    const savedLocations: Location[] = [];
    for (const loc of locations) {
      let existing = await this.locationRepo.findOne({ where: { name: loc.name } });
      if (!existing) {
        existing = await this.locationRepo.save(loc);
      }
      savedLocations.push(existing);
    }

    const sensorTypes = [
      { name: 'temperature', unit: '°C' },
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

    const LOCATION_POINT_COUNT: Record<string, number> = {
      'right arm': 2,
      'left arm':  2,
      'back':      4,
      'left leg':  3,
      'right leg': 3,
    };

    // Seed 2 mannequins
    const mannequinNames = ['Mannequin 1', 'Mannequin 2'];
    const savedMannequins: Mannequin[] = [];
    for (const name of mannequinNames) {
      let existing = await this.mannequinRepo.findOne({ where: { name } });
      if (!existing) {
        existing = await this.mannequinRepo.save({ name });
      }
      savedMannequins.push(existing);
    }

    // Assign any existing sensors without mannequin_id to Mannequin 1
    const mannequin1 = savedMannequins[0];
    await this.sensorRepo
      .createQueryBuilder()
      .update(Sensor)
      .set({ mannequinId: mannequin1.id })
      .where('mannequin_id IS NULL')
      .execute();

    // Seed 42 sensors per mannequin (84 total)
    for (const mannequin of savedMannequins) {
      for (const loc of savedLocations) {
        const pointCount = LOCATION_POINT_COUNT[loc.name];

        for (let point = 1; point <= pointCount; point++) {
          for (const type of savedSensorTypes) {
            const existing = await this.sensorRepo.findOne({
              where: {
                location: { id: loc.id },
                sensorType: { id: type.id },
                externalId: point,
                mannequinId: mannequin.id,
              },
            });

            if (!existing) {
              await this.sensorRepo.save({
                location: loc,
                sensorType: type,
                externalId: point,
                mannequin,
              });
            }
          }
        }
      }
    }

    console.log('✅ Seeder: 2 mannequins, 5 locations, 3 sensor types, 84 sensors created!');
  }
}
