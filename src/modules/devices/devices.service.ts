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
    return this.prisma.roomDevice.findMany({ orderBy: { created_at: 'asc' } });
  }

  async findOne(id: string) {
    const device = await this.prisma.roomDevice.findUnique({ where: { id } });
    if (!device) throw new NotFoundException(`Room device ${id} was not found`);
    return device;
  }

  async create(dto: CreateDeviceDto) {
    try {
      return await this.prisma.roomDevice.create({ data: dto });
    } catch (error) {
      if (isUniqueConflict(error))
        throw new ConflictException('Tuya device ID is already in use');
      throw error;
    }
  }

  async update(id: string, dto: UpdateDeviceDto) {
    await this.findOne(id);
    try {
      return await this.prisma.roomDevice.update({ where: { id }, data: dto });
    } catch (error) {
      if (isUniqueConflict(error))
        throw new ConflictException('Tuya device ID is already in use');
      throw error;
    }
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
