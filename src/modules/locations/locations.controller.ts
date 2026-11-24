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
import { CreateBuildingDto } from './dto/create-building.dto';
import { CreateDoorDto } from './dto/create-door.dto';
import { CreateFloorDto } from './dto/create-floor.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateBuildingDto } from './dto/update-building.dto';
import { UpdateDoorDto } from './dto/update-door.dto';
import { UpdateFloorDto } from './dto/update-floor.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { LocationsService } from './locations.service';

@ApiTags('Locations')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('visit-options')
  @ApiOperation({ summary: 'List active visitor-access locations' })
  visitOptions() {
    return this.locationsService.visitOptions();
  }

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.PIC, UserRole.ADMIN, UserRole.AUDITOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List buildings, floors, rooms, doors, and assigned locks' })
  findAll() {
    return this.locationsService.findAll();
  }

  @Post('buildings')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiCreatedResponse({ description: 'Building created' })
  createBuilding(@Body() dto: CreateBuildingDto) {
    return this.locationsService.createBuilding(dto);
  }

  @Patch('buildings/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  updateBuilding(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateBuildingDto,
  ) {
    return this.locationsService.updateBuilding(id, dto);
  }

  @Post('buildings/:buildingId/floors')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  createFloor(
    @Param('buildingId', new ParseUUIDPipe()) buildingId: string,
    @Body() dto: CreateFloorDto,
  ) {
    return this.locationsService.createFloor(buildingId, dto);
  }

  @Patch('floors/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  updateFloor(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateFloorDto,
  ) {
    return this.locationsService.updateFloor(id, dto);
  }

  @Post('floors/:floorId/rooms')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  createRoom(
    @Param('floorId', new ParseUUIDPipe()) floorId: string,
    @Body() dto: CreateRoomDto,
  ) {
    return this.locationsService.createRoom(floorId, dto);
  }

  @Patch('rooms/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  updateRoom(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateRoomDto,
  ) {
    return this.locationsService.updateRoom(id, dto);
  }

  @Post('rooms/:roomId/doors')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  createDoor(
    @Param('roomId', new ParseUUIDPipe()) roomId: string,
    @Body() dto: CreateDoorDto,
  ) {
    return this.locationsService.createDoor(roomId, dto);
  }

  @Patch('doors/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  updateDoor(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateDoorDto,
  ) {
    return this.locationsService.updateDoor(id, dto);
  }
}
