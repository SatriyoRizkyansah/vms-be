import { ApiPropertyOptional } from '@nestjs/swagger';
import { DoorEventType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class ListAuditLogsDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 50;

  @ApiPropertyOptional({ enum: DoorEventType })
  @IsOptional()
  @IsEnum(DoorEventType)
  event_type?: DoorEventType;

  @ApiPropertyOptional({ example: '2026-12-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.999Z' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
