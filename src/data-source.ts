import { DataSource } from 'typeorm';
import { SensorReading } from './sensor-reading/sensor-reading.entity';
import { Sensor } from './sensor/sensor.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',   
  password: '1',   
  database: 'hardware',
  entities: [Sensor, SensorReading],
  migrations: ['src/migrations/*.ts'],
  synchronize: false, // penting! harus false kalau udah pakai migration
});
