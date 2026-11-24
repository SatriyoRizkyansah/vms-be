import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  DeviceConnectionStatus,
  DoorEventType,
  Prisma,
  RoomDevice,
  VisitStatus,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../../prisma.module';
import { TuyaService } from '../tuya/tuya.service';
import { VisitsService } from '../visits/visits.service';

@Injectable()
export class LifecycleJobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LifecycleJobsService.name);
  private lifecycleTimer?: NodeJS.Timeout;
  private deviceTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly visitsService: VisitsService,
    private readonly tuyaService: TuyaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  onModuleInit() {
    void this.processVisitLifecycle();
    void this.syncDeviceHealth();
    this.lifecycleTimer = setInterval(
      () => void this.processVisitLifecycle(),
      5 * 60_000,
    );
    this.deviceTimer = setInterval(
      () => void this.syncDeviceHealth(),
      6 * 60 * 60_000,
    );
    this.lifecycleTimer.unref();
    this.deviceTimer.unref();
  }

  onModuleDestroy() {
    if (this.lifecycleTimer) clearInterval(this.lifecycleTimer);
    if (this.deviceTimer) clearInterval(this.deviceTimer);
  }

  private async processVisitLifecycle() {
    try {
      await this.resetStaleProvisionClaims();
      await this.sendExpiryReminders();
      await this.expireVisits();
    } catch (error) {
      this.logger.error(
        'Visit lifecycle job failed',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async resetStaleProvisionClaims() {
    const cutoff = new Date(Date.now() - 5 * 60_000);
    await this.prisma.visitRequest.updateMany({
      where: {
        status: VisitStatus.APPROVED,
        provisioning_started_at: { lt: cutoff },
      },
      data: {
        provisioning_started_at: null,
        provisioning_error:
          'Provision attempt timed out; verify Tuya before retrying.',
      },
    });
  }

  private async sendExpiryReminders() {
    const now = new Date();
    const due = await this.prisma.visitRequest.findMany({
      where: {
        status: { in: [VisitStatus.PROVISIONED, VisitStatus.CHECKED_IN] },
        expiry_reminder_sent_at: null,
        credential: {
          is: {
            is_revoked: false,
            effective_until: {
              gt: now,
              lte: new Date(now.getTime() + 10 * 60_000),
            },
          },
        },
      },
      select: { id: true },
      take: 100,
    });

    for (const visit of due) {
      try {
        const sent = await this.visitsService.sendExpiryReminder(visit.id);
        if (sent) await this.visitsService.markExpiryReminderSent(visit.id);
      } catch (error) {
        this.logger.warn(
          `Expiry reminder for visit ${visit.id} failed: ${toMessage(error)}`,
        );
      }
    }
  }

  private async expireVisits() {
    const now = new Date();
    const due = await this.prisma.visitRequest.findMany({
      where: {
        status: { in: [VisitStatus.PROVISIONED, VisitStatus.CHECKED_IN] },
        credential: {
          is: { effective_until: { lte: now }, is_revoked: false },
        },
      },
      select: { id: true },
      take: 100,
    });
    for (const visit of due) {
      try {
        await this.visitsService.expireVisit(
          visit.id,
          'Access validity period ended',
        );
      } catch (error) {
        this.logger.warn(
          `Automatic expiry for visit ${visit.id} failed: ${toMessage(error)}`,
        );
      }
    }
  }

  private async syncDeviceHealth() {
    let devices: RoomDevice[];
    try {
      devices = await this.prisma.roomDevice.findMany({
        where: { is_active: true },
      });
    } catch (error) {
      this.logger.error(
        `Could not load room devices for health sync: ${toMessage(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      return;
    }
    for (const device of devices) {
      try {
        const state = await this.tuyaService.getDeviceState(
          device.tuya_device_id,
        );
        const batteryLevel = readBatteryLevel(state.status ?? []);
        const connectionStatus =
          typeof state.online === 'boolean'
            ? state.online
              ? DeviceConnectionStatus.ONLINE
              : DeviceConnectionStatus.OFFLINE
            : device.connection_status;
        const now = new Date();
        await this.prisma.roomDevice.update({
          where: { id: device.id },
          data: {
            connection_status: connectionStatus,
            battery_level: batteryLevel ?? device.battery_level,
            last_synced_at: now,
          },
        });

        if (connectionStatus !== device.connection_status) {
          await this.createHealthAudit(
            device.id,
            connectionStatus === DeviceConnectionStatus.ONLINE
              ? DoorEventType.DEVICE_ONLINE
              : DoorEventType.DEVICE_OFFLINE,
            { online: state.online, source: 'six-hour Tuya health sync' },
            now,
          );
        }
        if (
          batteryLevel !== undefined &&
          batteryLevel < 20 &&
          (device.battery_level === null || device.battery_level >= 20)
        ) {
          await this.createHealthAudit(
            device.id,
            DoorEventType.LOW_BATTERY,
            {
              battery_level: batteryLevel,
              source: 'six-hour Tuya health sync',
            },
            now,
          );
          const admins = await this.prisma.user.findMany({
            where: { role: 'ADMIN', is_active: true },
            select: { email: true, phone_number: true },
          });
          await this.notificationsService.sendLowBatteryAlert({
            device_id: device.id,
            room_name: device.room_name,
            battery_level: batteryLevel,
            admins,
          });
        }
        this.logger.log(`Synced smart lock ${device.room_name}`);
      } catch (error) {
        this.logger.warn(
          `Could not sync smart lock ${device.room_name}: ${toMessage(error)}`,
        );
      }
    }
  }

  private createHealthAudit(
    deviceId: string,
    eventType: DoorEventType,
    rawPayload: Prisma.InputJsonValue,
    occurredAt: Date,
  ) {
    return this.prisma.doorAuditLog.create({
      data: {
        event_key: `health:${deviceId}:${randomUUID()}`,
        room_device_id: deviceId,
        event_type: eventType,
        raw_payload: rawPayload,
        occurred_at: occurredAt,
      },
    });
  }
}

function readBatteryLevel(status: Array<{ code: string; value: unknown }>) {
  const configuredCodes = process.env.TUYA_BATTERY_DP_CODES?.split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const codes = configuredCodes?.length
    ? configuredCodes
    : ['battery_percentage', 'battery', 'battery_state'];
  const value = status.find((entry) => codes.includes(entry.code))?.value;
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 100
  )
    return undefined;
  return value;
}

function toMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
}
