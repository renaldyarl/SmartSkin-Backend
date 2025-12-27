import { DataSource } from 'typeorm';
import { Location } from './location/location.entity';
import { SensorType } from './sensor/sensor-type.entity';
import { Sensor } from './sensor/sensor.entity';
import { SensorReading } from './sensor-reading/sensor-reading.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',     
  password: '1', 
  database: 'hardware',     
  entities: [Location, SensorType, Sensor, SensorReading],
  migrations: ['src/migrations/*.ts'],
  subscribers: [],
  synchronize: false,
  logging: false,
});