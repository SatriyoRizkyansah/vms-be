import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { TuyaEventsController } from './tuya-events.controller';
import { TuyaEventsService } from './tuya-events.service';

@Module({
  imports: [NotificationsModule],
  controllers: [TuyaEventsController],
  providers: [TuyaEventsService],
})
export class IntegrationsModule {}
