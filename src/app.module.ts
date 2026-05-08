import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SensorModule } from './sensor/sensor.module';
import { SensorReadingModule } from './sensor-reading/sensor-reading.module';
import { LoraModule } from './lora/lora.module';
import { Location } from './location/location.entity';
import { SensorType } from './sensor/sensor-type.entity';
import { Sensor } from './sensor/sensor.entity';
import { SensorReading } from './sensor-reading/sensor-reading.entity';
import { Mannequin } from './mannequin/mannequin.entity';
import { SeederModule } from './seeder/seeder.module';
import { SeederService } from './seeder/seeder.service';
import { SensorCacheModule } from './cache/sensor-cache.module';
import { WebSocketModule } from './websocket/websocket.module';
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
      entities: [Location, SensorType, Sensor, SensorReading, Mannequin],
      synchronize: process.env.DB_SYNCHRONIZATION === 'true',
      logging: process.env.DB_LOGGING === 'true',
      // Connection pool optimization for high-write workload (42 sensors/5sec)
      extra: {
        max: 30, // Maximum connections in pool
        min: 10, // Minimum connections to keep alive
        idleTimeoutMillis: 30000, // Close idle connections after 30s
        connectionTimeoutMillis: 2000, // Fail fast if no connection available
      },
    }),
    TypeOrmModule.forFeature([Location, SensorType, Sensor, SensorReading, Mannequin]),
    SensorCacheModule,
    WebSocketModule,
    SensorModule,
    SensorReadingModule,
    LoraModule,
    ...(process.env.NODE_ENV !== 'production' ? [SeederModule] : []),
  ],
  providers: [
    ...(process.env.NODE_ENV !== 'production' ? [SeederService] : []),
  ],
})
export class AppModule {}