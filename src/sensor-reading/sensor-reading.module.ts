import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SensorReading } from './sensor-reading.entity';
import { Sensor } from '../sensor/sensor.entity';
import { Location } from '../location/location.entity';
import { SensorReadingService } from './sensor-reading.service';
import { SensorReadingController } from './sensor-reading.controller';
import { SensorType } from '../sensor/sensor-type.entity';
import { SensorCacheModule } from '../cache/sensor-cache.module';
import { WebSocketModule } from '../websocket/websocket.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SensorReading,
      Sensor,
      Location,
      SensorType,
    ]),
    TypeOrmModule.forFeature([SensorReading, Sensor, Location]),
    SensorCacheModule,
    WebSocketModule,
  ],
  controllers: [SensorReadingController],
  providers: [SensorReadingService],
})
export class SensorReadingModule {}