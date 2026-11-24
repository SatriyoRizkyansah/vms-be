import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

export class UpdateSettingsDto {
  @ApiPropertyOptional({ minimum: 0, maximum: 180, default: 15 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(180)
  access_buffer_before_minutes?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 180, default: 15 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(180)
  access_buffer_after_minutes?: number;

  @ApiPropertyOptional({ example: '08:00', nullable: true })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  operating_hours_start?: string | null;

  @ApiPropertyOptional({ example: '17:00', nullable: true })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  operating_hours_end?: string | null;
}
