import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../../prisma.module';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const safeUserSelect = {
  id: true,
  nip_username: true,
  full_name: true,
  email: true,
  phone_number: true,
  role: true,
  is_active: true,
  created_at: true,
  updated_at: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  findAll() {
    return this.prisma.user.findMany({
      select: safeUserSelect,
      orderBy: { created_at: 'desc' },
    });
  }

  async create(dto: CreateUserDto) {
    try {
      const password_hash = await this.authService.createUserPassword(
        dto.password,
      );
      return await this.prisma.user.create({
        data: {
          nip_username: dto.nip_username,
          full_name: dto.full_name,
          email: dto.email,
          phone_number: dto.phone_number,
          role: dto.role,
          password_hash,
        },
        select: safeUserSelect,
      });
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw new ConflictException('Username or email is already in use');
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateUserDto, actorId: string) {
    const currentUser = await this.prisma.user.findUnique({ where: { id } });
    if (!currentUser) throw new NotFoundException(`User ${id} was not found`);
    if (
      id === actorId &&
      (dto.is_active === false || (dto.role && dto.role !== currentUser.role))
    ) {
      throw new ConflictException(
        'You cannot deactivate yourself or change your own role',
      );
    }
    const { password, ...data } = dto;
    const updateData = password
      ? {
          ...data,
          password_hash: await this.authService.createUserPassword(password),
        }
      : data;

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const removesLastActiveAdmin =
            currentUser.role === 'ADMIN' &&
            currentUser.is_active &&
            (dto.is_active === false ||
              (dto.role !== undefined && dto.role !== 'ADMIN'));
          if (removesLastActiveAdmin) {
            const activeAdmins = await tx.user.count({
              where: { role: 'ADMIN', is_active: true },
            });
            if (activeAdmins <= 1)
              throw new ConflictException(
                'At least one active admin account is required',
              );
          }
          return tx.user.update({
            where: { id },
            data: updateData,
            select: safeUserSelect,
          });
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw new ConflictException('Email is already in use');
      }
      throw error;
    }
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: safeUserSelect,
    });
    if (!user) throw new NotFoundException(`User ${id} was not found`);
    return user;
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
