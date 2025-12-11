import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SensorReading } from "./sensor-reading.entity";
import { SensorReadingService } from "./sensor-reading.service";
import { SensorReadingController } from "./sensor-reading.controller";

@Module({
  imports: [TypeOrmModule.forFeature([SensorReading])],
  controllers: [SensorReadingController],
  providers: [SensorReadingService],
})
export class SensorReadingModule {}
