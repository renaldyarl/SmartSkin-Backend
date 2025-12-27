// src/sensor/sensor.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sensor } from './sensor.entity';
import { SensorType } from '../sensor/sensor-type.entity';
import { Location } from '../location/location.entity';
import { SensorService } from './sensor.service';
import { SensorController } from './sensor.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sensor, SensorType, Location]),
  ],
  controllers: [SensorController],
  providers: [SensorService],
})
export class SensorModule {}