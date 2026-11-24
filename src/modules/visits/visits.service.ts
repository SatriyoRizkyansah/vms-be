import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CredentialType, Prisma, UserRole, VisitStatus } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { AuthenticatedUser } from '../../common/auth';
import {
  decryptCredential,
  encryptCredential,
  generatePin,
} from '../../common/credential-crypto';
import { PrismaService } from '../../prisma.module';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService, VmsSettings } from '../settings/settings.service';
import { TuyaService } from '../tuya/tuya.service';
import { CreateVisitDto } from './dto/create-visit.dto';
import { ExtendVisitDto } from './dto/extend-visit.dto';
import { ListVisitsDto } from './dto/list-visits.dto';
import { ManualCheckInDto } from './dto/manual-check-in.dto';
import { RejectVisitDto } from './dto/reject-visit.dto';

const visitSelect = {
  id: true,
  visit_code: true,
  visitor_name: true,
  visitor_identity_no: true,
  visitor_institution: true,
  visitor_phone: true,
  visitor_email: true,
  purpose: true,
  pic_user_id: true,
  room_device_id: true,
  registered_by_id: true,
  approved_by_id: true,
  scheduled_start: true,
  scheduled_end: true,
  is_emergency: true,
  status: true,
  provisioning_error: true,
  provisioning_started_at: false,
  rejection_reason: true,
  expiry_reminder_sent_at: false,
  approved_at: true,
  checked_in_at: true,
  completed_at: true,
  created_at: true,
  updated_at: true,
  pic: {
    select: {
      id: true,
      nip_username: true,
      full_name: true,
      email: true,
      phone_number: true,
    },
  },
  room: {
    select: {
      id: true,
      room_name: true,
      connection_status: true,
      battery_level: true,
    },
  },
  approved_by: { select: { id: true, full_name: true } },
  credential: {
    select: {
      id: true,
      tuya_password_id: true,
      pin_code_masked: true,
      pin_type: true,
      effective_from: true,
      effective_until: true,
      is_revoked: true,
      revoked_at: true,
    },
  },
} satisfies Prisma.VisitRequestSelect;

@Injectable()
export class VisitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
    private readonly tuyaService: TuyaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  listActivePics() {
    return this.prisma.user.findMany({
      where: { role: UserRole.PIC, is_active: true },
      select: { id: true, full_name: true },
      orderBy: { full_name: 'asc' },
    });
  }

  async findAll(query: ListVisitsDto, actor: AuthenticatedUser) {
    const search = query.search?.trim();
    const where: Prisma.VisitRequestWhereInput = {
      ...(actor.role === UserRole.PIC ? { pic_user_id: actor.id } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { visit_code: { contains: search, mode: 'insensitive' } },
              { visitor_name: { contains: search, mode: 'insensitive' } },
              {
                visitor_institution: { contains: search, mode: 'insensitive' },
              },
              {
                visitor_identity_no: { contains: search, mode: 'insensitive' },
              },
            ],
          }
        : {}),
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [data, total] = await Promise.all([
      this.prisma.visitRequest.findMany({
        where,
        select: visitSelect,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.visitRequest.count({ where }),
    ]);
    return {
      data,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, actor: AuthenticatedUser) {
    const visit = await this.prisma.visitRequest.findUnique({
      where: { id },
      select: visitSelect,
    });
    if (!visit) throw new NotFoundException(`Visit ${id} was not found`);
    this.assertCanView(visit.pic_user_id, actor);
    return visit;
  }

  async getStatusHistory(id: string, actor: AuthenticatedUser) {
    const visit = await this.findOne(id, actor);
    return this.prisma.visitStatusLog.findMany({
      where: { visit_request_id: visit.id },
      include: { changed_by: { select: { id: true, full_name: true } } },
      orderBy: { created_at: 'asc' },
    });
  }

  async create(
    dto: CreateVisitDto,
    registeredBy?: AuthenticatedUser,
    isEmergency = false,
  ) {
    if (
      registeredBy?.role === UserRole.PIC &&
      dto.pic_user_id !== registeredBy.id
    ) {
      throw new ForbiddenException(
        'PIC accounts can only register walk-in visits assigned to themselves',
      );
    }
    const start = new Date(dto.scheduled_start);
    const end = new Date(dto.scheduled_end);
    if (!(start < end))
      throw new BadRequestException(
        'Visit end time must be later than start time',
      );

    const [pic, room, settings] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: dto.pic_user_id, is_active: true, role: UserRole.PIC },
        select: { id: true, email: true, phone_number: true },
      }),
      dto.room_device_id
        ? this.prisma.roomDevice.findFirst({
            where: { id: dto.room_device_id, is_active: true },
          })
        : this.prisma.roomDevice.findFirst({
            where: { is_active: true },
            orderBy: { created_at: 'asc' },
          }),
      this.settingsService.getSettings(),
    ]);
    if (!pic)
      throw new BadRequestException('The selected PIC account is not active');
    if (!room)
      throw new BadRequestException('No active room device is configured');
    validateOperatingHours(start, end, settings, isEmergency);

    const visitCode = await this.createVisitCode();
    const visit = await this.prisma.visitRequest.create({
      data: {
        visit_code: visitCode,
        visitor_name: dto.visitor_name.trim(),
        visitor_identity_no: dto.visitor_identity_no.trim(),
        visitor_institution: dto.visitor_institution.trim(),
        visitor_phone: dto.visitor_phone.trim(),
        visitor_email: dto.visitor_email.trim().toLowerCase(),
        purpose: dto.purpose.trim(),
        pic_user_id: pic.id,
        room_device_id: room.id,
        registered_by_id: registeredBy?.id,
        scheduled_start: start,
        scheduled_end: end,
        is_emergency: isEmergency,
        status_history: {
          create: {
            to_status: VisitStatus.PENDING_APPROVAL,
            changed_by_id: registeredBy?.id,
            reason: registeredBy
              ? 'Walk-in registration'
              : 'Visitor pre-registration',
          },
        },
      },
      select: visitSelect,
    });
    const picContact = await this.prisma.user.findUniqueOrThrow({
      where: { id: pic.id },
      select: { email: true, phone_number: true },
    });
    await this.notificationsService.sendApprovalRequest({
      visit_request_id: visit.id,
      visit_code: visit.visit_code,
      visitor_name: visit.visitor_name,
      pic: picContact,
    });
    return visit;
  }

  async approve(id: string, actor: AuthenticatedUser) {
    const visit = await this.getRawVisit(id);
    this.assertCanManage(visit.pic_user_id, actor);
    if (visit.status !== VisitStatus.PENDING_APPROVAL) {
      throw new ConflictException(
        `Visit cannot be approved from ${visit.status}`,
      );
    }
    await this.prisma.$transaction([
      this.prisma.visitRequest.update({
        where: { id },
        data: {
          status: VisitStatus.APPROVED,
          approved_by_id: actor.id,
          approved_at: new Date(),
          provisioning_error: null,
        },
      }),
      this.prisma.visitStatusLog.create({
        data: {
          visit_request_id: id,
          from_status: VisitStatus.PENDING_APPROVAL,
          to_status: VisitStatus.APPROVED,
          changed_by_id: actor.id,
        },
      }),
    ]);
    return this.provision(id, actor);
  }

  async reject(id: string, dto: RejectVisitDto, actor: AuthenticatedUser) {
    const visit = await this.getRawVisit(id);
    this.assertCanManage(visit.pic_user_id, actor);
    if (visit.status !== VisitStatus.PENDING_APPROVAL) {
      throw new ConflictException(
        `Visit cannot be rejected from ${visit.status}`,
      );
    }
    await this.transition(
      id,
      VisitStatus.PENDING_APPROVAL,
      VisitStatus.REJECTED,
      actor.id,
      dto.reason,
      {
        rejection_reason: dto.reason,
      },
    );
    return this.findOne(id, actor);
  }

  async retryProvision(id: string, actor: AuthenticatedUser) {
    const visit = await this.getRawVisit(id);
    this.assertCanManage(visit.pic_user_id, actor);
    if (visit.status !== VisitStatus.APPROVED || visit.credential) {
      throw new ConflictException(
        'Only approved visits without a credential can be provisioned',
      );
    }
    return this.provision(id, actor);
  }

  async extend(id: string, dto: ExtendVisitDto, actor: AuthenticatedUser) {
    const visit = await this.getRawVisit(id);
    this.assertCanManage(visit.pic_user_id, actor);
    if (
      visit.status !== VisitStatus.CHECKED_IN ||
      !visit.credential ||
      visit.credential.is_revoked
    ) {
      throw new ConflictException(
        'Only a checked-in visit with an active credential can be extended',
      );
    }
    if (visit.credential.effective_until <= new Date()) {
      throw new ConflictException('The access window has already expired');
    }

    const scheduledEnd = new Date(
      visit.scheduled_end.getTime() + dto.minutes * 60_000,
    );
    const settings = await this.settingsService.getSettings();
    const effectiveUntil = addMinutes(
      scheduledEnd,
      settings.access_buffer_after_minutes,
    );
    const pin = decryptCredential(visit.credential);
    await this.tuyaService.modifyTemporaryPassword({
      device_id: visit.room.tuya_device_id,
      password_id: visit.credential.tuya_password_id!,
      pin,
      phone: visit.visitor_phone,
      effective_at: visit.credential.effective_from,
      expires_at: effectiveUntil,
    });

    await this.prisma.$transaction([
      this.prisma.visitRequest.update({
        where: { id },
        data: { scheduled_end: scheduledEnd, expiry_reminder_sent_at: null },
      }),
      this.prisma.accessCredential.update({
        where: { id: visit.credential.id },
        data: { effective_until: effectiveUntil },
      }),
    ]);
    return this.findOne(id, actor);
  }

  async checkOut(id: string, actor: AuthenticatedUser) {
    const visit = await this.getRawVisit(id);
    this.assertCanManage(visit.pic_user_id, actor);
    if (visit.status !== VisitStatus.CHECKED_IN) {
      throw new ConflictException('Only a checked-in visit can be checked out');
    }
    await this.revokeCredential(visit);
    await this.transition(
      id,
      VisitStatus.CHECKED_IN,
      VisitStatus.COMPLETED,
      actor.id,
      'Early check-out',
      {
        completed_at: new Date(),
      },
    );
    return this.findOne(id, actor);
  }

  async revoke(id: string, actor: AuthenticatedUser) {
    const visit = await this.getRawVisit(id);
    this.assertCanManage(visit.pic_user_id, actor);
    const allowed: VisitStatus[] = [
      VisitStatus.PENDING_APPROVAL,
      VisitStatus.APPROVED,
      VisitStatus.PROVISIONED,
    ];
    if (!allowed.includes(visit.status)) {
      throw new ConflictException(
        `Visit cannot be revoked from ${visit.status}`,
      );
    }
    if (visit.provisioning_started_at) {
      throw new ConflictException(
        'PIN provisioning is in progress; retry cancellation after it finishes',
      );
    }
    if (visit.credential && !visit.credential.is_revoked)
      await this.revokeCredential(visit);
    await this.transition(
      id,
      visit.status,
      VisitStatus.REVOKED,
      actor.id,
      'Visit cancelled',
    );
    return this.findOne(id, actor);
  }

  async manualCheckIn(
    id: string,
    dto: ManualCheckInDto,
    actor: AuthenticatedUser,
  ) {
    const visit = await this.getRawVisit(id);
    this.assertCanManage(visit.pic_user_id, actor);
    const allowed: VisitStatus[] = [
      VisitStatus.APPROVED,
      VisitStatus.PROVISIONED,
      VisitStatus.OFFLINE_FALLBACK,
    ];
    if (!allowed.includes(visit.status)) {
      throw new ConflictException(
        `Visit cannot be checked in from ${visit.status}`,
      );
    }
    if (visit.provisioning_started_at) {
      throw new ConflictException(
        'PIN provisioning is in progress; retry manual check-in after it finishes',
      );
    }
    await this.transition(
      id,
      visit.status,
      VisitStatus.CHECKED_IN,
      actor.id,
      dto.reason,
      {
        checked_in_at: new Date(),
      },
    );
    return this.findOne(id, actor);
  }

  async retryNotifications(id: string, actor: AuthenticatedUser) {
    const visit = await this.getRawVisit(id);
    this.assertCanManage(visit.pic_user_id, actor);
    if (
      ![VisitStatus.PROVISIONED, VisitStatus.CHECKED_IN].some(
        (status) => status === visit.status,
      ) ||
      !visit.credential
    ) {
      throw new ConflictException('A provisioned visit credential is required');
    }
    await this.notificationsService.sendVisitorCredential({
      visit,
      room_name: visit.room.room_name,
      pin: decryptCredential(visit.credential),
    });
    return this.prisma.notificationDelivery.findMany({
      where: { visit_request_id: id },
      orderBy: { created_at: 'desc' },
      take: 10,
      select: {
        id: true,
        channel: true,
        recipient: true,
        status: true,
        error_message: true,
        sent_at: true,
      },
    });
  }

  async expireVisit(id: string, reason: string) {
    const visit = await this.getRawVisit(id);
    if (
      ![VisitStatus.PROVISIONED, VisitStatus.CHECKED_IN].some(
        (status) => status === visit.status,
      )
    )
      return false;
    if (visit.credential && !visit.credential.is_revoked)
      await this.revokeCredential(visit);
    await this.transition(
      id,
      visit.status,
      VisitStatus.EXPIRED,
      undefined,
      reason,
    );
    return true;
  }

  async markExpiryReminderSent(id: string) {
    return this.prisma.visitRequest.updateMany({
      where: { id, expiry_reminder_sent_at: null },
      data: { expiry_reminder_sent_at: new Date() },
    });
  }

  async sendExpiryReminder(id: string) {
    const visit = await this.prisma.visitRequest.findUnique({
      where: { id },
      include: { pic: true, credential: true },
    });
    if (!visit?.credential) return;
    return this.notificationsService.sendExpiryReminder({
      visit_request_id: visit.id,
      visit_code: visit.visit_code,
      pic_name: visit.pic.full_name,
      pic_email: visit.pic.email,
      pic_phone: visit.pic.phone_number,
      visitor_name: visit.visitor_name,
      effective_until: visit.credential.effective_until,
    });
  }

  private async provision(id: string, actor: AuthenticatedUser) {
    const now = new Date();
    const claimed = await this.prisma.visitRequest.updateMany({
      where: {
        id,
        status: VisitStatus.APPROVED,
        credential: { is: null },
        OR: [
          { provisioning_started_at: null },
          {
            provisioning_started_at: {
              lt: new Date(now.getTime() - 5 * 60_000),
            },
          },
        ],
      },
      data: { provisioning_started_at: now, provisioning_error: null },
    });
    if (claimed.count !== 1) {
      throw new ConflictException(
        'This visit is already being provisioned or is no longer eligible',
      );
    }

    let passwordId: string | undefined;
    let pin: string | undefined;
    let visit: Awaited<ReturnType<VisitsService['getRawVisit']>>;
    let result: Prisma.VisitRequestGetPayload<{ select: typeof visitSelect }>;
    try {
      visit = await this.getRawVisit(id);
      const settings = await this.settingsService.getSettings();
      const effectiveFrom = addMinutes(
        visit.scheduled_start,
        -settings.access_buffer_before_minutes,
      );
      const effectiveUntil = addMinutes(
        visit.scheduled_end,
        settings.access_buffer_after_minutes,
      );
      pin = await this.createUniquePin(
        visit.room_device_id,
        visit.room.pin_length,
      );
      const created = await this.tuyaService.createTemporaryPassword({
        device_id: visit.room.tuya_device_id,
        name: `${visit.visit_code} ${visit.visitor_name}`,
        pin,
        phone: visit.visitor_phone,
        effective_at: effectiveFrom,
        expires_at: effectiveUntil,
      });
      passwordId = created.password_id;
      const encrypted = encryptCredential(pin);
      const maskedPin = `${'•'.repeat(pin.length - 4)}${pin.slice(-4)}`;

      result = await this.prisma.$transaction(async (tx) => {
        const claim = await tx.visitRequest.updateMany({
          where: {
            id,
            status: VisitStatus.APPROVED,
            provisioning_started_at: now,
          },
          data: { provisioning_error: null },
        });
        if (claim.count !== 1) {
          throw new ConflictException(
            'Visit was cancelled or changed during PIN provisioning',
          );
        }
        await tx.accessCredential.create({
          data: {
            visit_request_id: id,
            tuya_password_id: passwordId,
            pin_code_masked: maskedPin,
            pin_ciphertext: encrypted.ciphertext,
            pin_iv: encrypted.iv,
            pin_auth_tag: encrypted.auth_tag,
            pin_type: CredentialType.ONLINE_TEMP,
            effective_from: effectiveFrom,
            effective_until: effectiveUntil,
          },
        });
        await tx.visitStatusLog.create({
          data: {
            visit_request_id: id,
            from_status: VisitStatus.APPROVED,
            to_status: VisitStatus.PROVISIONED,
            changed_by_id: actor.id,
            reason: 'Temporary PIN provisioned by Tuya',
          },
        });
        return tx.visitRequest.update({
          where: { id },
          data: {
            status: VisitStatus.PROVISIONED,
            provisioning_error: null,
            provisioning_started_at: null,
          },
          select: visitSelect,
        });
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown provisioning error';
      if (passwordId) {
        const visit = await this.getRawVisit(id).catch(() => null);
        if (visit) {
          await this.tuyaService
            .deleteTemporaryPassword(visit.room.tuya_device_id, passwordId)
            .catch(() => undefined);
        }
      }
      const failed = await this.prisma.visitRequest.updateMany({
        where: { id, status: VisitStatus.APPROVED },
        data: {
          provisioning_started_at: null,
          provisioning_error: message.slice(0, 500),
        },
      });
      if (passwordId || failed.count === 0) throw error;
      return {
        visit: await this.findOne(id, actor),
        provisioning: { status: 'FAILED', error_message: message },
      };
    }

    await this.notificationsService.sendVisitorCredential({
      visit: visit!,
      room_name: visit!.room.room_name,
      pin: pin!,
    });
    return {
      visit: result,
      visitor_pin: pin,
      provisioning: { status: 'PROVISIONED' },
    };
  }

  private async createUniquePin(deviceId: string, length: number) {
    const now = new Date();
    const active = await this.prisma.accessCredential.findMany({
      where: {
        is_revoked: false,
        effective_until: { gt: now },
        visit: { room_device_id: deviceId },
      },
      select: {
        pin_ciphertext: true,
        pin_iv: true,
        pin_auth_tag: true,
      },
    });
    const activePins = new Set(
      active.map((credential) => decryptCredential(credential)),
    );
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const pin = generatePin(length);
      if (!activePins.has(pin)) return pin;
    }
    throw new ConflictException('Could not allocate a unique temporary PIN');
  }

  private async revokeCredential(
    visit: Awaited<ReturnType<VisitsService['getRawVisit']>>,
  ) {
    const credential = visit.credential;
    if (!credential || credential.is_revoked) return;
    if (credential.tuya_password_id) {
      await this.tuyaService.deleteTemporaryPassword(
        visit.room.tuya_device_id,
        credential.tuya_password_id,
      );
    }
    await this.prisma.accessCredential.update({
      where: { id: credential.id },
      data: { is_revoked: true, revoked_at: new Date() },
    });
  }

  private async transition(
    id: string,
    from: VisitStatus,
    to: VisitStatus,
    actorId?: string,
    reason?: string,
    extra: Prisma.VisitRequestUpdateInput = {},
  ) {
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.visitRequest.updateMany({
        where: { id, status: from },
        data: { ...extra, status: to },
      });
      if (updated.count !== 1)
        throw new ConflictException(
          'Visit status changed; reload and try again',
        );
      await tx.visitStatusLog.create({
        data: {
          visit_request_id: id,
          from_status: from,
          to_status: to,
          changed_by_id: actorId,
          reason,
        },
      });
    });
  }

  private async getRawVisit(id: string) {
    const visit = await this.prisma.visitRequest.findUnique({
      where: { id },
      include: { room: true, credential: true },
    });
    if (!visit) throw new NotFoundException(`Visit ${id} was not found`);
    return visit;
  }

  private async createVisitCode() {
    const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = `VMS-${date}-${randomBytes(3).toString('hex').toUpperCase()}`;
      const exists = await this.prisma.visitRequest.findUnique({
        where: { visit_code: code },
      });
      if (!exists) return code;
    }
    throw new ConflictException('Could not allocate a visit code');
  }

  private assertCanView(picId: string, actor: AuthenticatedUser) {
    if (actor.role === UserRole.PIC && actor.id !== picId) {
      throw new ForbiddenException(
        'PIC accounts can only access their own visits',
      );
    }
  }

  private assertCanManage(picId: string, actor: AuthenticatedUser) {
    if (
      actor.role !== UserRole.ADMIN &&
      !(actor.role === UserRole.PIC && actor.id === picId)
    ) {
      throw new ForbiddenException(
        'Only the assigned PIC or an admin can manage this visit',
      );
    }
  }
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function validateOperatingHours(
  start: Date,
  end: Date,
  settings: VmsSettings,
  isEmergency: boolean,
) {
  if (
    isEmergency ||
    !settings.operating_hours_start ||
    !settings.operating_hours_end
  )
    return;
  const startLocal = getLocalDateTime(start, settings.timezone);
  const endLocal = getLocalDateTime(end, settings.timezone);
  if (startLocal.date !== endLocal.date) {
    throw new BadRequestException(
      'Visits must start and end on the same local operating day',
    );
  }
  if (
    startLocal.time < settings.operating_hours_start ||
    endLocal.time > settings.operating_hours_end
  ) {
    throw new BadRequestException(
      `Visit must fall within operating hours ${settings.operating_hours_start}–${settings.operating_hours_end} (${settings.timezone})`,
    );
  }
}

function getLocalDateTime(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
  };
}
