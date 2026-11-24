import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard, Roles, RolesGuard } from '../../common/auth';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { DevicesService } from './devices.service';

@ApiTags('Room Devices')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  @Roles(UserRole.PIC, UserRole.ADMIN, UserRole.AUDITOR)
  @ApiOperation({ summary: 'List room smart locks and health state' })
  findAll() {
    return this.devicesService.findAll();
  }

  @Get(':id')
  @Roles(UserRole.PIC, UserRole.ADMIN, UserRole.AUDITOR)
  @ApiOperation({ summary: 'Get room smart-lock status' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.devicesService.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Register a Tuya smart lock' })
  @ApiCreatedResponse({ description: 'Registered room device' })
  create(@Body() dto: CreateDeviceDto) {
    return this.devicesService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a room smart lock' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateDeviceDto,
  ) {
    return this.devicesService.update(id, dto);
  }
}
