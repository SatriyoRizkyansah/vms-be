import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.module';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListAuditLogsDto) {
    const where = this.getWhere(query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const [data, total] = await Promise.all([
      this.prisma.doorAuditLog.findMany({
        where,
        include: {
          room: { select: { id: true, room_name: true } },
          visit: {
            select: {
              id: true,
              visit_code: true,
              visitor_name: true,
              visitor_institution: true,
              pic: { select: { id: true, full_name: true } },
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { occurred_at: 'desc' },
      }),
      this.prisma.doorAuditLog.count({ where }),
    ]);
    return {
      data,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const log = await this.prisma.doorAuditLog.findUnique({
      where: { id },
      include: {
        room: { select: { id: true, room_name: true } },
        visit: {
          select: {
            id: true,
            visit_code: true,
            visitor_name: true,
            visitor_institution: true,
            pic: { select: { id: true, full_name: true } },
          },
        },
      },
    });
    if (!log) throw new NotFoundException(`Audit log ${id} was not found`);
    return log;
  }

  private getWhere(query: ListAuditLogsDto): Prisma.DoorAuditLogWhereInput {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (from && to && from >= to)
      throw new BadRequestException('The from date must be before the to date');
    return {
      ...(query.event_type ? { event_type: query.event_type } : {}),
      ...(from || to
        ? {
            occurred_at: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };
  }
}
