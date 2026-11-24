import {
  Controller,
  Get,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard, Roles, RolesGuard } from '../../common/auth';
import { DateRangeDto } from './dto/date-range.dto';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.AUDITOR)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('visits.csv')
  @ApiOperation({ summary: 'Export visit requests as CSV' })
  @ApiProduces('text/csv')
  async visitsCsv(@Query() range: DateRangeDto) {
    const report = await this.reportsService.visitReport(range);
    return new StreamableFile(
      Buffer.from(this.reportsService.toCsv(report), 'utf8'),
      {
        type: 'text/csv; charset=utf-8',
        disposition: 'attachment; filename="vms-visits.csv"',
      },
    );
  }

  @Get('visits.pdf')
  @ApiOperation({ summary: 'Export visit requests as PDF' })
  @ApiProduces('application/pdf')
  async visitsPdf(@Query() range: DateRangeDto) {
    const report = await this.reportsService.visitReport(range);
    return new StreamableFile(await this.reportsService.toPdf(report), {
      type: 'application/pdf',
      disposition: 'attachment; filename="vms-visits.pdf"',
    });
  }

  @Get('door-audit.csv')
  @ApiOperation({ summary: 'Export door audit logs as CSV' })
  @ApiProduces('text/csv')
  async doorAuditCsv(@Query() range: DateRangeDto) {
    const report = await this.reportsService.doorAuditReport(range);
    return new StreamableFile(
      Buffer.from(this.reportsService.toCsv(report), 'utf8'),
      {
        type: 'text/csv; charset=utf-8',
        disposition: 'attachment; filename="vms-door-audit.csv"',
      },
    );
  }

  @Get('door-audit.pdf')
  @ApiOperation({ summary: 'Export door audit logs as PDF' })
  @ApiProduces('application/pdf')
  async doorAuditPdf(@Query() range: DateRangeDto) {
    const report = await this.reportsService.doorAuditReport(range);
    return new StreamableFile(await this.reportsService.toPdf(report), {
      type: 'application/pdf',
      disposition: 'attachment; filename="vms-door-audit.pdf"',
    });
  }
}
