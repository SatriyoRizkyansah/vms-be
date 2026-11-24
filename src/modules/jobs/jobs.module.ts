import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { TuyaModule } from '../tuya/tuya.module';
import { VisitsModule } from '../visits/visits.module';
import { LifecycleJobsService } from './lifecycle-jobs.service';

@Module({
  imports: [VisitsModule, TuyaModule, NotificationsModule],
  providers: [LifecycleJobsService],
})
export class JobsModule {}
