import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDoorDto {
  @ApiProperty({ example: 'Pintu Utama' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ example: 'TEL-201-IN' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  code?: string;
}
