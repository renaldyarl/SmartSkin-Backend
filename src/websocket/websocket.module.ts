import { Module } from '@nestjs/common';
import { SensorGateway } from './sensor.gateway';

@Module({
  providers: [SensorGateway],
  exports: [SensorGateway],
})
export class WebSocketModule {}
