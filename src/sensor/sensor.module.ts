import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sensor } from './sensor.entity';
import { SensorReading } from '../sensor-reading/sensor-reading.entity';
import { SensorService } from './sensor.service';
import { SensorController } from './sensor.controller';
import { SensorReadingService } from '../sensor-reading/sensor-reading.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sensor, SensorReading])
  ],
  controllers: [SensorController],
  providers: [SensorService, SensorReadingService],
  exports: [SensorService, SensorReadingService],
})
export class SensorModule {}
