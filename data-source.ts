import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { SensorReading } from './src/sensor/sensor.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: '1',
  database: 'smart_skin',
  entities: [SensorReading],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
});
