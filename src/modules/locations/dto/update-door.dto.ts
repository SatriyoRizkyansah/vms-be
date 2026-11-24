import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateDoorDto } from './create-door.dto';

export class UpdateDoorDto extends PartialType(CreateDoorDto) {
  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ example: true })
  is_active?: boolean;
}
