import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard, CurrentUser, Roles, RolesGuard } from '../../common/auth';
import type { AuthenticatedUser } from '../../common/auth';
import { CreateVisitDto } from './dto/create-visit.dto';
import { ExtendVisitDto } from './dto/extend-visit.dto';
import { ListVisitsDto } from './dto/list-visits.dto';
import { ManualCheckInDto } from './dto/manual-check-in.dto';
import { RejectVisitDto } from './dto/reject-visit.dto';
import { WalkInVisitDto } from './dto/walk-in-visit.dto';
import { VisitsService } from './visits.service';

@ApiTags('Visits')
@Controller('visits')
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a public visitor pre-registration request' })
  @ApiCreatedResponse({ description: 'Visit request awaiting PIC approval' })
  create(@Body() dto: CreateVisitDto) {
    return this.visitsService.create(dto);
  }

  @Get('pics')
  @ApiOperation({
    summary: 'List PIC names available for visitor pre-registration',
  })
  @ApiOkResponse({ description: 'Active PIC account IDs and names' })
  listActivePics() {
    return this.visitsService.listActivePics();
  }

  @Post('walk-in')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.PIC, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register a walk-in visitor' })
  @ApiCreatedResponse({
    description: 'Visit request, optionally approved immediately',
  })
  async createWalkIn(
    @Body() dto: WalkInVisitDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const visit = await this.visitsService.create(
      dto,
      actor,
      dto.is_emergency ?? false,
    );
    if (dto.auto_approve) return this.visitsService.approve(visit.id, actor);
    return visit;
  }

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.PIC, UserRole.ADMIN, UserRole.AUDITOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List visits visible to the signed-in account' })
  findAll(
    @Query() query: ListVisitsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.visitsService.findAll(query, actor);
  }

  @Get(':id/status-history')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.PIC, UserRole.ADMIN, UserRole.AUDITOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Read immutable visit status history' })
  getStatusHistory(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.visitsService.getStatusHistory(id, actor);
  }

  @Get(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.PIC, UserRole.ADMIN, UserRole.AUDITOR)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get visit details, including masked access credential',
  })
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.visitsService.findOne(id, actor);
  }

  @Post(':id/approve')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.PIC, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve a visit and provision its temporary PIN' })
  approve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.visitsService.approve(id, actor);
  }

  @Post(':id/reject')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.PIC, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject a pending visit request' })
  reject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RejectVisitDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.visitsService.reject(id, dto, actor);
  }

  @Post(':id/provision')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.PIC, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Retry temporary PIN provisioning for an approved visit',
  })
  retryProvision(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.visitsService.retryProvision(id, actor);
  }

  @Post(':id/extend')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.PIC, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Extend a checked-in visit by 30 or 60 minutes' })
  extend(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ExtendVisitDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.visitsService.extend(id, dto, actor);
  }

  @Post(':id/check-out')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.PIC, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check out a visitor and revoke the temporary PIN' })
  checkOut(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.visitsService.checkOut(id, actor);
  }

  @Post(':id/revoke')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.PIC, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cancel a visit and remove any provisioned temporary PIN',
  })
  revoke(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.visitsService.revoke(id, actor);
  }

  @Post(':id/manual-check-in')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.PIC, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Record a manually verified visitor arrival' })
  manualCheckIn(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ManualCheckInDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.visitsService.manualCheckIn(id, dto, actor);
  }

  @Post(':id/notifications/retry')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.PIC, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Retry delivery of the visit credential notification',
  })
  retryNotifications(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.visitsService.retryNotifications(id, actor);
  }
}
