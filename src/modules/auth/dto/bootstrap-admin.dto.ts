import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class BootstrapAdminDto {
  @ApiProperty({ example: 'Administrator VMS' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  full_name: string;

  @ApiProperty({ example: 'admin.vms' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  username: string;

  @ApiProperty({ example: 'admin@example.org' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiPropertyOptional({ example: '+6281234567890' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone_number?: string;

  @ApiProperty({ minLength: 12 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password: string;
}
