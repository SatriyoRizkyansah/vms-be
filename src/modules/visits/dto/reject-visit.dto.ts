import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RejectVisitDto {
  @ApiProperty({ example: 'Jadwal belum dapat disetujui' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}
