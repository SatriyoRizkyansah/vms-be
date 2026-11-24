import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRoomDto {
  @ApiProperty({ example: 'Ruang Telematika' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name: string;

  @ApiPropertyOptional({ example: 'TEL-201' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  code?: string;

  @ApiPropertyOptional({ example: 'Ruang server dan operasional jaringan' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
