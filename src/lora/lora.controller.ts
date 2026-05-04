import {
  Controller,
  Post,
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
}
