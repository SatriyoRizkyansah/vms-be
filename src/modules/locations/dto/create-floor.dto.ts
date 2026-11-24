import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateFloorDto {
  @ApiProperty({ example: 'Lantai 2' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  floor_number?: number;
}
