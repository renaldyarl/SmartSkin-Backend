import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { LoraService } from './lora.service';

@Controller('lora')
export class LoraController {
  constructor(private readonly loraService: LoraService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  receive(@Body() body: any, @Query('mid') mid?: string) {
    const parsed = mid != null ? parseInt(mid, 10) : undefined;
    const midQuery = Number.isFinite(parsed) ? parsed : undefined;
    return this.loraService.processPayload(body, midQuery);
  }

  @Get('health')
  health(@Query('mid') mid?: string) {
    const parsed = mid != null ? parseInt(mid, 10) : undefined;
    return this.loraService.getHealth(Number.isFinite(parsed) ? parsed : undefined);
  }

  @Get('diagnostics')
  diagnostics(@Query('mid') mid?: string) {
    const parsed = mid != null ? parseInt(mid, 10) : undefined;
    return this.loraService.getDiagnostics(Number.isFinite(parsed) ? parsed : undefined);
  }
}
