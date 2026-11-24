import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.module';
import { UpdateSettingsDto } from './dto/update-settings.dto';

export interface VmsSettings {
  access_buffer_before_minutes: number;
  access_buffer_after_minutes: number;
  operating_hours_start: string | null;
  operating_hours_end: string | null;
  timezone: string;
}

const defaults: VmsSettings = {
  access_buffer_before_minutes: 15,
  access_buffer_after_minutes: 15,
  operating_hours_start: null,
  operating_hours_end: null,
  timezone: process.env.VMS_TIMEZONE ?? 'Asia/Jakarta',
};

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<VmsSettings> {
    const entries = await this.prisma.systemSetting.findMany();
    const values = new Map(entries.map(({ key, value }) => [key, value]));
    return {
      access_buffer_before_minutes: Number(
        values.get('access_buffer_before_minutes') ??
          defaults.access_buffer_before_minutes,
      ),
      access_buffer_after_minutes: Number(
        values.get('access_buffer_after_minutes') ??
          defaults.access_buffer_after_minutes,
      ),
      operating_hours_start: values.get('operating_hours_start') ?? null,
      operating_hours_end: values.get('operating_hours_end') ?? null,
      timezone: defaults.timezone,
    };
  }

  async updateSettings(dto: UpdateSettingsDto) {
    const current = await this.getSettings();
    const nextStart =
      dto.operating_hours_start === undefined
        ? current.operating_hours_start
        : dto.operating_hours_start;
    const nextEnd =
      dto.operating_hours_end === undefined
        ? current.operating_hours_end
        : dto.operating_hours_end;
    if (Boolean(nextStart) !== Boolean(nextEnd)) {
      throw new BadRequestException(
        'Operating start and end times must be configured together',
      );
    }
    if (nextStart && nextEnd && nextStart >= nextEnd) {
      throw new BadRequestException(
        'Operating end time must be later than start time',
      );
    }

    const entries: Array<[string, string | number | null | undefined]> = [
      ['access_buffer_before_minutes', dto.access_buffer_before_minutes],
      ['access_buffer_after_minutes', dto.access_buffer_after_minutes],
      ['operating_hours_start', dto.operating_hours_start],
      ['operating_hours_end', dto.operating_hours_end],
    ];
    await this.prisma.$transaction(
      entries
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) =>
          value === null
            ? this.prisma.systemSetting.deleteMany({ where: { key } })
            : this.prisma.systemSetting.upsert({
                where: { key },
                create: { key, value: String(value) },
                update: { value: String(value) },
              }),
        ),
    );
    return this.getSettings();
  }
}
