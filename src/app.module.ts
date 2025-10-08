import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SensorReading } from './sensor/sensor.entity';
import { SensorModule } from './sensor/sensor.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: '1', 
      database: 'smart_skin',
      entities: [SensorReading],
      synchronize: true,         // auto sync table (hanya untuk dev)
    }),
    SensorModule,
  ],
})
export class AppModule {}
