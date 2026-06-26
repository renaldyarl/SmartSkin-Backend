// scripts/seed-admins.ts
// Idempotent seeding of the 2 admin accounts (stas-rg, pindad).
// Runs in any NODE_ENV (unlike SeederModule which is dev-only), because these
// accounts must also exist on the deployed backend.
//
//   npm run seed:admin
//
// Credentials come from env (see .env.example). Falls back to dev defaults with
// a loud warning so you don't accidentally ship default passwords.
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';

interface AdminSpec {
  username: string;
  password: string;
  displayName: string;
  usingDefaultPassword: boolean;
}

function resolveAdmins(): AdminSpec[] {
  const specs = [
    {
      username: process.env.ADMIN_STASRG_USERNAME || 'stas-rg',
      password: process.env.ADMIN_STASRG_PASSWORD,
      displayName: 'Admin STAS-RG',
      fallback: 'stasrg123',
    },
    {
      username: process.env.ADMIN_PINDAD_USERNAME || 'pindad',
      password: process.env.ADMIN_PINDAD_PASSWORD,
      displayName: 'Admin PINDAD',
      fallback: 'pindad123',
    },
  ];

  return specs.map((s) => ({
    username: s.username,
    password: s.password || s.fallback,
    displayName: s.displayName,
    usingDefaultPassword: !s.password,
  }));
}

async function run() {
  const admins = resolveAdmins();

  const app = await NestFactory.createApplicationContext(AppModule);
  const authService = app.get(AuthService, { strict: false });

  for (const admin of admins) {
    await authService.upsertAdmin(
      admin.username,
      admin.password,
      admin.displayName,
    );
    if (admin.usingDefaultPassword) {
      console.warn(
        `⚠️  "${admin.username}" is using the DEFAULT dev password. ` +
          `Set ADMIN_*_PASSWORD in .env before deploying.`,
      );
    }
  }

  await app.close();
  console.log(`✅ Admin seeder completed (${admins.length} accounts).`);
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ Admin seeder failed:', error);
  process.exit(1);
});
