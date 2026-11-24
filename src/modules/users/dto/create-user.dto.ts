import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'pic.telematika' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nip_username: string;

  @ApiProperty({ example: 'Nama Pegawai' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  full_name: string;

  @ApiProperty({ example: 'pic@example.org' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiPropertyOptional({ example: '+6281234567890' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone_number?: string;

  @ApiProperty({ enum: UserRole, default: UserRole.PIC })
  @IsEnum(UserRole)
  role = UserRole.PIC;

  @ApiProperty({ minLength: 12 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password: string;
}
