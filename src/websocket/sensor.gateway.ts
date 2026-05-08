import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://ss.stas-rg.com',
      'https://ss.stas-rg.com',
    ],
    credentials: true,
  },
  namespace: '/sensor',
})
export class SensorGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('SensorGateway');

  afterInit() {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  emitBatchUpdate(readings: Array<{
    sensorType: string;
    value: number;
    location: string;
    sensorNumber: number;
    timestamp: Date;
    mannequin_id: number;
  }>) {
    this.server.emit('sensor-batch-update', readings);
    this.logger.debug(`Emitted sensor-batch-update: ${readings.length} readings`);
  }
}
