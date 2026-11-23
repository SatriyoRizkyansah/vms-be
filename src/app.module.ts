import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma.module';
import { ExampleItemsModule } from './modules/example-items/example-items.module';
import { HealthController } from './health.controller';

@Module({
  imports: [PrismaModule, ExampleItemsModule],
  controllers: [HealthController],
})
export class AppModule {}
