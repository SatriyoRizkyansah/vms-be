import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard, Roles, RolesGuard } from '../../common/auth';
import { AuditLogsService } from './audit-logs.service';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';

@ApiTags('Door Audit Logs')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.AUDITOR)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @ApiOperation({ summary: 'List immutable door access and device events' })
  findAll(@Query() query: ListAuditLogsDto) {
    return this.auditLogsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read an immutable door event and its payload' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.auditLogsService.findOne(id);
  }
}
