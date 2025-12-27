// src/app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SensorModule } from './sensor/sensor.module';
import { SensorReadingModule } from './sensor-reading/sensor-reading.module';
import { Location } from './location/location.entity';
import { SensorType } from './sensor/sensor-type.entity';
import { Sensor } from './sensor/sensor.entity';
import { SensorReading } from './sensor-reading/sensor-reading.entity';

import { SeederModule } from './seeder/seeder.module';
import { SeederService } from './seeder/seeder.service';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: '1',
      database: 'hardware',
      entities: [Location, SensorType, Sensor, SensorReading],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([Location, SensorType, Sensor, SensorReading]),
    SensorModule,
    SensorReadingModule,
    ...(process.env.NODE_ENV !== 'production' ? [SeederModule] : []),
  ],
  providers: [
    ...(process.env.NODE_ENV !== 'production' ? [SeederService] : []),
  ],
})
export class AppModule {}