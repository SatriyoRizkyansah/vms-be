import { PartialType } from '@nestjs/swagger';
import { CreateExampleItemDto } from './create-example-item.dto';

export class UpdateExampleItemDto extends PartialType(CreateExampleItemDto) {}
