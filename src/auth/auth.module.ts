import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import { User } from './user.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import * as dotenv from 'dotenv';

// Load .env before JwtModule.register() reads JWT_SECRET below. Without this,
// this module is imported by app.module BEFORE its dotenv.config() runs, so the
// sign secret (here) and the verify secret (JwtStrategy, constructed later)
// would diverge → every token rejected with 401.
dotenv.config();

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-insecure-secret-change-me',
      // Cast: env value is a plain string; expiresIn wants string | number.
      signOptions: {
        expiresIn: process.env.JWT_EXPIRES_IN || '12h',
      } as JwtSignOptions,
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    // Global guard → every HTTP route requires a valid JWT unless marked @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
