import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sensor } from './sensor/sensor.entity';
import { SensorModule } from './sensor/sensor.module';
import { SensorType } from './sensor/sensor-type.entity';
import { Location } from './sensor/location.entity';
import { SensorReading } from './sensor-reading/sensor-reading.entity';
import { SensorReadingModule } from "./sensor-reading/sensor-reading.module";

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: '1', 
      database: 'hardware',
      entities: [Sensor, SensorType, Location, SensorReading],
      synchronize: false,
      migrations: ['dist/migrations/*.js'],
      migrationsRun: true,
    }),
    SensorModule,SensorReadingModule,
  ],
})
export class AppModule {}
