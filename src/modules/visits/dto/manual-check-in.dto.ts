import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ManualCheckInDto {
  @ApiProperty({ example: 'Kehadiran diverifikasi langsung oleh petugas' })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason: string;
}
