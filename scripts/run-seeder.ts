// scripts/run-seeder.ts
import { NestFactory } from '@nestjs/core';
import { SeederService } from '../src/seeder/seeder.service';
import { AppModule } from '../src/app.module'; 

async function runSeeder() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const seeder = app.get(SeederService, { strict: false });
  
  await seeder.seed();
  await app.close();
  console.log('✅ Seeder completed!');
  process.exit(0);
}

runSeeder().catch((error) => {
  console.error('❌ Seeder failed:', error);
  process.exit(1);
});