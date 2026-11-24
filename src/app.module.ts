import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma.module';
import { HealthController } from './health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { DevicesModule } from './modules/devices/devices.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SettingsModule } from './modules/settings/settings.module';
import { UsersModule } from './modules/users/users.module';
import { VisitsModule } from './modules/visits/visits.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    VisitsModule,
    DevicesModule,
    SettingsModule,
    IntegrationsModule,
    AuditLogsModule,
    ReportsModule,
    JobsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
