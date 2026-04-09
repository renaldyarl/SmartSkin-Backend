import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SensorCacheService } from './sensor-cache.service';
import { Location } from '../location/location.entity';
import { SensorType } from '../sensor/sensor-type.entity';
import { Sensor } from '../sensor/sensor.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Location, SensorType, Sensor]),
  ],
  providers: [SensorCacheService],
  exports: [SensorCacheService],
})
export class SensorCacheModule {}
