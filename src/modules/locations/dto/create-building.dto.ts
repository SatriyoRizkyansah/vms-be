import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBuildingDto {
  @ApiProperty({ example: 'Gedung Utama' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name: string;

  @ApiProperty({ example: 'GEDUNG-UTAMA' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  code: string;

  @ApiPropertyOptional({ example: 'Jl. Ciledug Raya, Jakarta Selatan' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;
}
