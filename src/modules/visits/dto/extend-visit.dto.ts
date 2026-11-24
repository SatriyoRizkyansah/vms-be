import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class ExtendVisitDto {
  @ApiProperty({ enum: [30, 60] })
  @IsIn([30, 60])
  minutes: 30 | 60;
}
