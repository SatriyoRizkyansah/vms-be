import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.module';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.roomDevice.findMany({
      orderBy: { created_at: 'asc' },
      include: {
        door: {
          include: {
            room: { include: { floor: { include: { building: true } } } },
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const device = await this.prisma.roomDevice.findUnique({ where: { id } });
    if (!device) throw new NotFoundException(`Room device ${id} was not found`);
    return device;
  }

  async create(dto: CreateDeviceDto) {
    const door = await this.requireActiveDoor(dto.door_id);
    try {
      return await this.prisma.roomDevice.create({
        data: { ...dto, room_name: door.room.name },
        include: { door: true },
      });
    } catch (error) {
      if (isUniqueConflict(error))
        throw new ConflictException('Tuya device ID is already in use');
      throw error;
    }
  }

  async update(id: string, dto: UpdateDeviceDto) {
    await this.findOne(id);
    const { door_id, ...changes } = dto;
    const door = door_id ? await this.requireActiveDoor(door_id) : null;
    try {
      return await this.prisma.roomDevice.update({
        where: { id },
        data: {
          ...changes,
          ...(door ? { door_id: door.id, room_name: door.room.name } : {}),
        },
        include: { door: true },
      });
    } catch (error) {
      if (isUniqueConflict(error))
        throw new ConflictException('Tuya device ID is already in use');
      throw error;
    }
  }

  private async requireActiveDoor(id: string) {
    const door = await this.prisma.door.findUnique({
      where: { id },
      include: { room: { include: { floor: { include: { building: true } } } } },
    });
    if (!door) throw new NotFoundException(`Door ${id} was not found`);
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
