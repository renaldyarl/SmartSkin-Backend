import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { Location } from './location/location.entity';
import { SensorType } from './sensor/sensor-type.entity';
import { Sensor } from './sensor/sensor.entity';
import { SensorReading } from './sensor-reading/sensor-reading.entity';
import { Mannequin } from './mannequin/mannequin.entity';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'postgres',
  entities: [Location, SensorType, Sensor, SensorReading, Mannequin],
  migrations: ['src/migrations/*.ts'],
  subscribers: [],
  synchronize: false,
  logging: false,
});