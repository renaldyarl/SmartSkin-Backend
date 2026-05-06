// src/seeder/seeder.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Location } from '../location/location.entity';
import { SensorType } from '../sensor/sensor-type.entity';
import { Sensor } from '../sensor/sensor.entity';
import { Mannequin } from '../mannequin/mannequin.entity';
import { SeederService } from './seeder.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Location, SensorType, Sensor, Mannequin]),
  ],
  providers: [SeederService],
  exports: [SeederService],
})
export class SeederModule {}