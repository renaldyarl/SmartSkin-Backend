import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { LoraService } from './lora.service';

@Controller('lora')
export class LoraController {
  constructor(private readonly loraService: LoraService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  receive(
    @Body() body: any,
    @Query('mid', new DefaultValuePipe(1), ParseIntPipe) mid: number,
  ) {
    return this.loraService.processPayload(body, mid);
  }

  @Get('health')
  health(@Query('mid') mid?: string) {
    const parsed = mid != null ? parseInt(mid, 10) : undefined;
    return this.loraService.getHealth(Number.isFinite(parsed) ? parsed : undefined);
  }
}
