import { Module } from '@nestjs/common';
import { ExampleItemsController } from './example-items.controller';
import { ExampleItemsService } from './example-items.service';

@Module({
  controllers: [ExampleItemsController],
  providers: [ExampleItemsService],
})
export class ExampleItemsModule {}
