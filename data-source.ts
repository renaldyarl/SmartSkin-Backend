import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Sensor } from './src/sensor/sensor.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: '1',
  database: 'hardware',
  entities: [Sensor],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
});
