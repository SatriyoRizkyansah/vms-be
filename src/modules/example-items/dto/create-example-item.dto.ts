import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateExampleItemDto {
  @ApiProperty({ example: 'Visitor badge' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title: string;

  @ApiPropertyOptional({ example: 'Temporary badge for a guest' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
