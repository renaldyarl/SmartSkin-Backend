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
import * as dotenv from 'dotenv';

dotenv.config();

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT) || 5432,
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'postgres',
      entities: [Location, SensorType, Sensor, SensorReading],
      synchronize: process.env.DB_SYNCHRONIZATION === 'true',
      logging: process.env.DB_LOGGING === 'true',
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
export class AppModule { }