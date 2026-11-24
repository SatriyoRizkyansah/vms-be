import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateVisitDto {
  @ApiProperty({ example: 'Budi Santoso' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  visitor_name: string;

  @ApiProperty({ example: '3174xxxxxxxxxxxx' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  visitor_identity_no: string;

  @ApiProperty({ example: 'PT Contoh Indonesia' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  visitor_institution: string;

  @ApiProperty({ example: '+6281234567890' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  visitor_phone: string;

  @ApiProperty({ example: 'budi@example.org' })
  @IsEmail()
  @MaxLength(254)
  visitor_email: string;

  @ApiProperty({ example: 'Pemeliharaan perangkat jaringan' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  purpose: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  pic_user_id: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Defaults to the active pilot room device',
  })
  @IsOptional()
  @IsUUID()
  room_device_id?: string;

  @ApiProperty({ example: '2026-12-01T02:00:00.000Z' })
  @IsDateString()
  scheduled_start: string;

  @ApiProperty({ example: '2026-12-01T03:00:00.000Z' })
  @IsDateString()
  scheduled_end: string;
}
