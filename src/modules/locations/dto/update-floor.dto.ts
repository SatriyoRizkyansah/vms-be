import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateFloorDto } from './create-floor.dto';

export class UpdateFloorDto extends PartialType(CreateFloorDto) {
  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ example: true })
  is_active?: boolean;
}
