import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.username, dto.password);
  }

  // Protected by the global JwtAuthGuard — returns the current token's user.
  @Get('me')
  me(@Req() req: Request & { user: { userId: number } }) {
    return this.authService.getById(req.user.userId);
  }
}
