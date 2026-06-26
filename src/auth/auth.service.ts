import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(username: string, password: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { username } });
    // Same error whether the user is missing or the password is wrong —
    // don't leak which usernames exist.
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    return user;
  }

  async login(username: string, password: string) {
    const user = await this.validateUser(username, password);
    const payload = { sub: user.id, username: user.username, role: user.role };
    const access_token = await this.jwtService.signAsync(payload);
    return {
      access_token,
      user: {
        username: user.username,
        displayName: user.displayName,
        role: user.role,
      },
    };
  }

  async getById(id: number) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new UnauthorizedException();
    return {
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    };
  }

  // Idempotent upsert used by the admin seed script (scripts/seed-admins.ts).
  async upsertAdmin(username: string, password: string, displayName: string) {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const existing = await this.userRepo.findOne({ where: { username } });
    if (existing) {
      existing.passwordHash = passwordHash;
      existing.displayName = displayName;
      existing.role = 'admin';
      await this.userRepo.save(existing);
      this.logger.log(`Updated admin "${username}"`);
    } else {
      await this.userRepo.save(
        this.userRepo.create({
          username,
          passwordHash,
          displayName,
          role: 'admin',
        }),
      );
      this.logger.log(`Created admin "${username}"`);
    }
  }
}
