import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel } from '@prisma/client';
import { PrismaService } from '../../prisma.module';

interface DeliveryContext {
  visit_request_id?: string;
  room_device_id?: string;
  subject: string;
  message: string;
  recipients: Array<{ channel: NotificationChannel; recipient: string }>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async sendApprovalRequest(input: {
    visit_request_id: string;
    visit_code: string;
    visitor_name: string;
    pic: { email: string; phone_number: string | null };
  }) {
    const recipients: DeliveryContext['recipients'] = [
      { channel: NotificationChannel.EMAIL, recipient: input.pic.email },
    ];
    if (input.pic.phone_number) {
      recipients.push({
        channel: NotificationChannel.WHATSAPP,
        recipient: input.pic.phone_number,
      });
    }
    return (
      (await this.dispatch({
        visit_request_id: input.visit_request_id,
        subject: `Persetujuan kunjungan ${input.visit_code}`,
        message: `Pengajuan kunjungan baru dari ${input.visitor_name} menunggu persetujuan Anda. Kode kunjungan: ${input.visit_code}.`,
        recipients,
      })) > 0
    );
  }

  async sendVisitorCredential(input: {
    visit: {
      id: string;
      visit_code: string;
      visitor_name: string;
      visitor_email: string;
      visitor_phone: string;
      scheduled_start: Date;
      scheduled_end: Date;
    };
    room_name: string;
    pin: string;
  }) {
    const timezone = process.env.VMS_TIMEZONE ?? 'Asia/Jakarta';
    const message = [
      `Halo ${input.visit.visitor_name}, kunjungan Anda telah disetujui.`,
      `Kode kunjungan: ${input.visit.visit_code}`,
      `Ruangan: ${input.room_name}`,
      `Jadwal: ${formatDate(input.visit.scheduled_start, timezone)} – ${formatDate(input.visit.scheduled_end, timezone)}`,
      `PIN akses: ${input.pin}`,
      'PIN aktif sesuai jadwal kunjungan. Sentuh keypad hingga menyala, ketik PIN, lalu tekan #.',
    ].join('\n');

    await this.dispatch({
      visit_request_id: input.visit.id,
      subject: `Tiket kunjungan ${input.visit.visit_code}`,
      message,
      recipients: [
        {
          channel: NotificationChannel.EMAIL,
          recipient: input.visit.visitor_email,
        },
        {
          channel: NotificationChannel.WHATSAPP,
          recipient: input.visit.visitor_phone,
        },
      ],
    });
  }

  async sendExpiryReminder(input: {
    visit_request_id: string;
    visit_code: string;
    pic_name: string;
    pic_email: string;
    pic_phone: string | null;
    visitor_name: string;
    effective_until: Date;
  }) {
    const timezone = process.env.VMS_TIMEZONE ?? 'Asia/Jakarta';
    const recipients: DeliveryContext['recipients'] = [
      { channel: NotificationChannel.EMAIL, recipient: input.pic_email },
    ];
    if (input.pic_phone)
      recipients.push({
        channel: NotificationChannel.WHATSAPP,
        recipient: input.pic_phone,
      });
    return (
      (await this.dispatch({
        visit_request_id: input.visit_request_id,
        subject: `Pengingat akhir akses ${input.visit_code}`,
        message: `Akses ${input.visitor_name} untuk kunjungan ${input.visit_code} akan berakhir pada ${formatDate(input.effective_until, timezone)}.`,
        recipients,
      })) > 0
    );
  }

  async sendLowBatteryAlert(input: {
    device_id: string;
    room_name: string;
    battery_level: number;
    admins: Array<{ email: string; phone_number: string | null }>;
  }) {
    const recipients = input.admins.flatMap((admin) => [
      { channel: NotificationChannel.EMAIL, recipient: admin.email },
      ...(admin.phone_number
        ? [
            {
              channel: NotificationChannel.WHATSAPP,
              recipient: admin.phone_number,
            },
          ]
        : []),
    ]);
    await this.dispatch({
      room_device_id: input.device_id,
      subject: `Peringatan baterai kunci ${input.room_name}`,
      message: `Baterai smart lock ${input.room_name} terdeteksi ${input.battery_level}%. Mohon jadwalkan penggantian baterai.`,
      recipients,
    });
  }

  async sendDeviceSecurityAlert(input: {
    device_id: string;
    room_name: string;
    alert: string;
    admins: Array<{ email: string; phone_number: string | null }>;
  }) {
    const recipients: DeliveryContext['recipients'] = input.admins.flatMap(
      (admin) => [
        { channel: NotificationChannel.EMAIL, recipient: admin.email },
        ...(admin.phone_number
          ? [
              {
                channel: NotificationChannel.WHATSAPP,
                recipient: admin.phone_number,
              },
            ]
          : []),
      ],
    );
    await this.dispatch({
      room_device_id: input.device_id,
      subject: `Peringatan keamanan kunci ${input.room_name}`,
      message: input.alert,
      recipients,
    });
  }

  private async dispatch(context: DeliveryContext) {
    const recipients = context.recipients.filter(({ recipient }) =>
      recipient?.trim(),
    );
    if (recipients.length === 0) return 0;

    const results = await Promise.all(
      recipients.map(async ({ channel, recipient }) => {
        const delivery = await this.prisma.notificationDelivery.create({
          data: {
            visit_request_id: context.visit_request_id,
            room_device_id: context.room_device_id,
            channel,
            recipient,
          },
        });
        const gatewayUrl = process.env.NOTIFICATION_GATEWAY_URL?.trim();
        if (!gatewayUrl) {
          await this.markFailed(
            delivery.id,
            'NOTIFICATION_GATEWAY_URL is not configured',
          );
          return;
        }

        try {
          const response = await fetch(gatewayUrl, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              ...(process.env.NOTIFICATION_GATEWAY_TOKEN
                ? {
                    authorization: `Bearer ${process.env.NOTIFICATION_GATEWAY_TOKEN}`,
                  }
                : {}),
            },
            body: JSON.stringify({
              channel,
              recipient,
              subject: context.subject,
              message: context.message,
            }),
            signal: AbortSignal.timeout(2_000),
          });
          if (!response.ok)
            throw new Error(`Gateway returned HTTP ${response.status}`);
          await this.prisma.notificationDelivery.update({
            where: { id: delivery.id },
            data: { status: 'SENT', sent_at: new Date() },
          });
          return true;
        } catch (error) {
          const reason =
            error instanceof Error ? error.message : 'Unknown delivery error';
          await this.markFailed(delivery.id, reason);
          return false;
        }
      }),
    );
    return results.filter(Boolean).length;
  }

  private async markFailed(id: string, reason: string) {
    const safeReason = reason.slice(0, 500);
    await this.prisma.notificationDelivery.update({
      where: { id },
      data: { status: 'FAILED', error_message: safeReason },
    });
    this.logger.warn(`Notification ${id} failed: ${safeReason}`);
  }
}

function formatDate(value: Date, timezone: string) {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: timezone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value);
}
