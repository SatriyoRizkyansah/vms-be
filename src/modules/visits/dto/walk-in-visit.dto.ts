import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateVisitDto } from './create-visit.dto';

export class WalkInVisitDto extends CreateVisitDto {
  @ApiPropertyOptional({
    default: false,
    description: 'Approve and provision a PIN immediately',
  })
  @IsOptional()
  @IsBoolean()
  auto_approve?: boolean;

  @ApiPropertyOptional({
    default: false,
    description: 'Emergency maintenance outside configured hours',
  })
  @IsOptional()
  @IsBoolean()
  is_emergency?: boolean;
}
