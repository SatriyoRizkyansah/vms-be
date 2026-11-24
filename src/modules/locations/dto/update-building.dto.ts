import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateBuildingDto } from './create-building.dto';

export class UpdateBuildingDto extends PartialType(CreateBuildingDto) {
  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ example: true })
  is_active?: boolean;
}
