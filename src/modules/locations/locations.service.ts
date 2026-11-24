import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.module';
import { CreateBuildingDto } from './dto/create-building.dto';
import { CreateDoorDto } from './dto/create-door.dto';
import { CreateFloorDto } from './dto/create-floor.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateBuildingDto } from './dto/update-building.dto';
import { UpdateDoorDto } from './dto/update-door.dto';
import { UpdateFloorDto } from './dto/update-floor.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.building.findMany({
      orderBy: { name: 'asc' },
      include: {
        floors: {
          orderBy: [{ floor_number: 'asc' }, { name: 'asc' }],
          include: {
            rooms: {
              orderBy: { name: 'asc' },
              include: {
                doors: {
                  orderBy: { name: 'asc' },
                  include: {
                    devices: {
                      select: {
                        id: true,
                        room_name: true,
                        is_active: true,
                        battery_level: true,
                        connection_status: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async visitOptions() {
    const devices = await this.prisma.roomDevice.findMany({
      where: { is_active: true },
      orderBy: { room_name: 'asc' },
      include: {
        door: {
          include: {
            room: { include: { floor: { include: { building: true } } } },
          },
        },
      },
    });

    return devices
      .filter((device) => {
        const door = device.door;
        if (!door) return true;
        return (
          door.is_active &&
          door.room.is_active &&
          door.room.floor.is_active &&
          door.room.floor.building.is_active
        );
      })
      .map((device) => {
        const door = device.door;
        const label = door
          ? [
              door.room.floor.building.name,
              door.room.floor.name,
              door.room.name,
              door.name,
            ].join(' / ')
          : device.room_name;
        return { room_device_id: device.id, label };
      });
  }

  async createBuilding(dto: CreateBuildingDto) {
    try {
      return await this.prisma.building.create({ data: dto });
    } catch (error) {
      if (isUniqueConflict(error))
        throw new ConflictException('Building code is already in use');
      throw error;
    }
  }

  async updateBuilding(id: string, dto: UpdateBuildingDto) {
    const building = await this.prisma.building.findUnique({ where: { id } });
    if (!building) throw new NotFoundException('Building was not found');
    try {
      return await this.prisma.building.update({ where: { id }, data: dto });
    } catch (error) {
      if (isUniqueConflict(error))
        throw new ConflictException('Building code is already in use');
      throw error;
    }
  }

  async createFloor(buildingId: string, dto: CreateFloorDto) {
    await this.requireBuilding(buildingId);
    try {
      return await this.prisma.buildingFloor.create({
        data: { ...dto, building_id: buildingId },
      });
    } catch (error) {
      if (isUniqueConflict(error))
        throw new ConflictException('Floor already exists in this building');
      throw error;
    }
  }

  async updateFloor(id: string, dto: UpdateFloorDto) {
    const floor = await this.prisma.buildingFloor.findUnique({
      where: { id },
      include: { building: true },
    });
    if (!floor) throw new NotFoundException('Floor was not found');
    if (dto.is_active && !floor.building.is_active) {
      throw new ConflictException('Parent building is inactive');
    }
    try {
      return await this.prisma.buildingFloor.update({
        where: { id },
        data: dto,
      });
    } catch (error) {
      if (isUniqueConflict(error))
        throw new ConflictException('Floor already exists in this building');
      throw error;
    }
  }

  async createRoom(floorId: string, dto: CreateRoomDto) {
    await this.requireFloor(floorId);
    try {
      return await this.prisma.room.create({
        data: { ...dto, floor_id: floorId },
      });
    } catch (error) {
      if (isUniqueConflict(error))
        throw new ConflictException('Room already exists on this floor');
      throw error;
    }
  }

  async updateRoom(id: string, dto: UpdateRoomDto) {
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: { floor: { include: { building: true } } },
    });
    if (!room) throw new NotFoundException('Room was not found');
    if (
      dto.is_active &&
      (!room.floor.is_active || !room.floor.building.is_active)
    ) {
      throw new ConflictException('Parent location is inactive');
    }
    try {
      return await this.prisma.room.update({ where: { id }, data: dto });
    } catch (error) {
      if (isUniqueConflict(error))
        throw new ConflictException('Room already exists on this floor');
      throw error;
    }
  }

  async createDoor(roomId: string, dto: CreateDoorDto) {
    await this.requireRoom(roomId);
    try {
      return await this.prisma.door.create({
        data: { ...dto, room_id: roomId },
      });
    } catch (error) {
      if (isUniqueConflict(error))
        throw new ConflictException('Door already exists in this room');
      throw error;
    }
  }

  async updateDoor(id: string, dto: UpdateDoorDto) {
    const door = await this.prisma.door.findUnique({
      where: { id },
      include: { room: { include: { floor: { include: { building: true } } } } },
    });
    if (!door) throw new NotFoundException('Door was not found');
    if (
      dto.is_active &&
      (!door.room.is_active ||
        !door.room.floor.is_active ||
        !door.room.floor.building.is_active)
    ) {
      throw new ConflictException('Parent location is inactive');
    }
    try {
      return await this.prisma.door.update({ where: { id }, data: dto });
    } catch (error) {
      if (isUniqueConflict(error))
        throw new ConflictException('Door already exists in this room');
      throw error;
    }
  }

  private async requireBuilding(id: string) {
    const building = await this.prisma.building.findUnique({ where: { id } });
    if (!building) throw new NotFoundException('Building was not found');
    if (!building.is_active)
      throw new ConflictException('Building is inactive');
    return building;
  }

  private async requireFloor(id: string) {
    const floor = await this.prisma.buildingFloor.findUnique({
      where: { id },
      include: { building: true },
    });
    if (!floor) throw new NotFoundException('Floor was not found');
    if (!floor.is_active || !floor.building.is_active)
      throw new ConflictException('Floor or parent building is inactive');
    return floor;
  }

  private async requireRoom(id: string) {
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: { floor: { include: { building: true } } },
    });
    if (!room) throw new NotFoundException('Room was not found');
    if (
      !room.is_active ||
      !room.floor.is_active ||
      !room.floor.building.is_active
    ) {
      throw new ConflictException('Room or parent location is inactive');
    }
    return room;
  }

  private async requireDoor(id: string) {
    const door = await this.prisma.door.findUnique({
      where: { id },
      include: { room: { include: { floor: { include: { building: true } } } } },
    });
    if (!door) throw new NotFoundException('Door was not found');
    if (
      !door.is_active ||
      !door.room.is_active ||
      !door.room.floor.is_active ||
      !door.room.floor.building.is_active
    ) {
      throw new ConflictException('Door or parent location is inactive');
    }
    return door;
  }
}

function isUniqueConflict(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
