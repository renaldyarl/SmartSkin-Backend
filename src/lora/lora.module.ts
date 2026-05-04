import { Module } from '@nestjs/common';
import { LoraController } from './lora.controller';
import { LoraService } from './lora.service';
import { SensorReadingModule } from '../sensor-reading/sensor-reading.module';

@Module({
  imports: [SensorReadingModule],
  controllers: [LoraController],
  providers: [LoraService],
})
export class LoraModule {}
