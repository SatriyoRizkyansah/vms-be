import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DoorEventType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class TuyaEventDto {
  @ApiProperty({ example: 'tuya-device-id' })
  @IsString()
  @MaxLength(120)
  tuya_device_id: string;

  @ApiProperty({ enum: DoorEventType })
  @IsEnum(DoorEventType)
  event_type: DoorEventType;

  @ApiProperty({ example: '2026-12-01T02:10:00.000Z' })
  @IsDateString()
  occurred_at: string;

  @ApiPropertyOptional({ example: '124367346' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  password_id?: string;

  @ApiPropertyOptional({ example: 'unique-tuya-event-id' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  event_key?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  battery_level?: number;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  raw_payload: Record<string, unknown>;
}
