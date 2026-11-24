import { BadRequestException, Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../../prisma.module';
import { DateRangeDto } from './dto/date-range.dto';

export type ReportData = { title: string; headers: string[]; rows: string[][] };

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async visitReport(range: DateRangeDto): Promise<ReportData> {
    const { from, to } = validateDateRange(range);
    const visits = await this.prisma.visitRequest.findMany({
      where: { created_at: { gte: from, lte: to } },
      include: {
        pic: { select: { full_name: true } },
        room: { select: { room_name: true } },
      },
      orderBy: { created_at: 'asc' },
      take: 20_000,
    });
    return {
      title: 'Visit Requests',
      headers: [
        'Visit Code',
        'Visitor',
        'Identity Number',
        'Institution',
        'Phone',
        'Email',
        'Purpose',
        'PIC',
        'Room',
        'Scheduled Start',
        'Scheduled End',
        'Status',
        'Created At',
      ],
      rows: visits.map((visit) => [
        visit.visit_code,
        visit.visitor_name,
        visit.visitor_identity_no,
        visit.visitor_institution,
        visit.visitor_phone,
        visit.visitor_email,
        visit.purpose,
        visit.pic.full_name,
        visit.room.room_name,
        visit.scheduled_start.toISOString(),
        visit.scheduled_end.toISOString(),
        visit.status,
        visit.created_at.toISOString(),
      ]),
    };
  }

  async doorAuditReport(range: DateRangeDto): Promise<ReportData> {
    const { from, to } = validateDateRange(range);
    const logs = await this.prisma.doorAuditLog.findMany({
      where: { occurred_at: { gte: from, lte: to } },
      include: {
        room: { select: { room_name: true } },
        visit: {
          select: {
            visit_code: true,
            visitor_name: true,
            pic: { select: { full_name: true } },
          },
        },
      },
      orderBy: { occurred_at: 'asc' },
      take: 20_000,
    });
    return {
      title: 'Door Access Audit Logs',
      headers: [
        'Occurred At',
        'Event Type',
        'Room',
        'Visit Code',
        'Visitor',
        'PIC',
        'Tuya Credential Reference',
        'Raw Payload',
      ],
      rows: logs.map((log) => [
        log.occurred_at.toISOString(),
        log.event_type,
        log.room.room_name,
        log.visit?.visit_code ?? '',
        log.visit?.visitor_name ?? '',
        log.visit?.pic.full_name ?? '',
        log.tuya_credential_ref ?? '',
        JSON.stringify(log.raw_payload),
      ]),
    };
  }

  toCsv(report: ReportData) {
    return [report.headers, ...report.rows]
      .map((row) => row.map(escapeCsvCell).join(','))
      .join('\r\n');
  }

  toPdf(report: ReportData) {
    return new Promise<Buffer>((resolve, reject) => {
      const document = new PDFDocument({
        size: 'A4',
        margin: 42,
        info: { Title: report.title },
      });
      const chunks: Buffer[] = [];
      document.on('data', (chunk: Buffer) => chunks.push(chunk));
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.on('error', reject);
      document.fontSize(16).text(report.title, { continued: false });
      document.moveDown(0.5);
      document.fontSize(8).text(`Generated ${new Date().toISOString()}`);
      document.moveDown();
      if (!report.rows.length) {
        document.fontSize(10).text('No records found for this date range.');
      }
      report.rows.forEach((row, index) => {
        if (document.y > 720) document.addPage();
        document
          .fontSize(8)
          .fillColor('#222222')
          .text(`${index + 1}. ${row[0]} | ${row[1]}`);
        document
          .fontSize(7)
          .fillColor('#555555')
          .text(
            row
              .slice(2)
              .map(
                (value, fieldIndex) =>
                  `${report.headers[fieldIndex + 2]}: ${value}`,
              )
              .join(' | '),
            { width: 510 },
          );
        document.moveDown(0.4);
      });
      document.end();
    });
  }
}

function validateDateRange(range: DateRangeDto) {
  const from = new Date(range.from);
  const to = new Date(range.to);
  if (!(from < to))
    throw new BadRequestException(
      'The report start must be before the report end',
    );
  if (to.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1000) {
    throw new BadRequestException('A report range cannot exceed 366 days');
  }
  return { from, to };
}

function escapeCsvCell(value: string) {
  const normalized = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${normalized.replaceAll('"', '""')}"`;
}
