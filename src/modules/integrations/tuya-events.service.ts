import { Injectable, NotFoundException } from '@nestjs/common';
import {
  DeviceConnectionStatus,
  DoorEventType,
  Prisma,
  VisitStatus,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../../prisma.module';
import { TuyaEventDto } from './dto/tuya-event.dto';

@Injectable()
export class TuyaEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async ingest(dto: TuyaEventDto) {
    const device = await this.prisma.roomDevice.findUnique({
      where: { tuya_device_id: dto.tuya_device_id },
    });
    if (!device)
      throw new NotFoundException('Tuya device is not registered in VMS');

    const credential = dto.password_id
      ? await this.prisma.accessCredential.findFirst({
          where: {
            tuya_password_id: dto.password_id,
            visit: { room_device_id: device.id },
          },
          include: { visit: true },
        })
      : null;
    const occurredAt = new Date(dto.occurred_at);
    const batteryLevel = dto.battery_level ?? readBatteryLevel(dto.raw_payload);
    const connectionStatus =
      dto.event_type === DoorEventType.DEVICE_ONLINE
        ? DeviceConnectionStatus.ONLINE
        : dto.event_type === DoorEventType.DEVICE_OFFLINE
          ? DeviceConnectionStatus.OFFLINE
          : undefined;
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.doorAuditLog.create({
          data: {
            event_key: dto.event_key,
            room_device_id: device.id,
            visit_request_id: credential?.visit_request_id,
            event_type: dto.event_type,
            tuya_credential_ref: dto.password_id,
            raw_payload: dto.raw_payload as Prisma.InputJsonValue,
            occurred_at: occurredAt,
          },
        });

        if (batteryLevel !== undefined || connectionStatus) {
          await tx.roomDevice.update({
            where: { id: device.id },
            data: {
              ...(batteryLevel === undefined
                ? {}
                : { battery_level: batteryLevel }),
              ...(connectionStatus
                ? { connection_status: connectionStatus }
                : {}),
              last_synced_at: occurredAt,
            },
          });
        }

        if (
          dto.event_type === DoorEventType.UNLOCK_PIN &&
          credential &&
          !credential.is_revoked &&
          occurredAt >= credential.effective_from &&
          occurredAt <= credential.effective_until &&
          credential.visit.status === VisitStatus.PROVISIONED
        ) {
          const changed = await tx.visitRequest.updateMany({
            where: {
              id: credential.visit_request_id,
              status: VisitStatus.PROVISIONED,
            },
            data: { status: VisitStatus.CHECKED_IN, checked_in_at: occurredAt },
          });
          if (changed.count === 1) {
            await tx.visitStatusLog.create({
              data: {
                visit_request_id: credential.visit_request_id,
                from_status: VisitStatus.PROVISIONED,
                to_status: VisitStatus.CHECKED_IN,
                reason: 'Door unlock event correlated to the temporary PIN',
                created_at: occurredAt,
              },
            });
          }
        }
      });
    } catch (error) {
      if (isUniqueConflict(error) && dto.event_key) {
        return { received: true, duplicate: true };
      }
      throw error;
    }

    if (
      batteryLevel !== undefined &&
      batteryLevel < 20 &&
      (device.battery_level === null || device.battery_level >= 20)
    ) {
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

    if (
      dto.event_type === DoorEventType.TAMPER ||
      dto.event_type === DoorEventType.WRONG_PIN
    ) {
      const admins = await this.prisma.user.findMany({
        where: { role: 'ADMIN', is_active: true },
        select: { email: true, phone_number: true },
      });
      const failedPinCount =
        dto.event_type === DoorEventType.WRONG_PIN
          ? await this.prisma.doorAuditLog.count({
              where: {
                room_device_id: device.id,
                event_type: DoorEventType.WRONG_PIN,
                occurred_at: {
                  gte: new Date(occurredAt.getTime() - 5 * 60_000),
                  lte: occurredAt,
                },
              },
            })
          : 0;
      if (dto.event_type === DoorEventType.TAMPER || failedPinCount === 5) {
        const alert =
          dto.event_type === DoorEventType.TAMPER
            ? `Tuya melaporkan indikasi pembongkaran pada ${device.room_name}. Periksa pintu dan hubungi petugas keamanan.`
            : `Smart lock ${device.room_name} menerima lima percobaan PIN salah dalam lima menit. Periksa kondisi pintu dan bantu verifikasi tamu.`;
        await this.notificationsService.sendDeviceSecurityAlert({
          device_id: device.id,
          room_name: device.room_name,
          alert,
          admins,
        });
      }
    }

    return {
      received: true,
      correlated_visit_id: credential?.visit_request_id ?? null,
    };
  }
}

function readBatteryLevel(payload: Record<string, unknown>) {
  const value = payload.battery_level ?? payload.battery;
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 100
  )
    return undefined;
  return value;
}

function isUniqueConflict(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
