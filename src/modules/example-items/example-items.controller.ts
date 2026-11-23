import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CreateExampleItemDto } from './dto/create-example-item.dto';
import { ListExampleItemsDto } from './dto/list-example-items.dto';
import { UpdateExampleItemDto } from './dto/update-example-item.dto';
import { ExampleItemsService } from './example-items.service';

@ApiTags('Example Items')
@Controller('example-items')
export class ExampleItemsController {
  constructor(private readonly exampleItemsService: ExampleItemsService) {}

  @Get()
  @ApiOperation({ summary: 'List example items' })
  @ApiOkResponse({ description: 'Paginated list of example items' })
  findAll(@Query() query: ListExampleItemsDto) {
    return this.exampleItemsService.findAll(query);
  }

  @Post()
  @ApiOperation({ summary: 'Create an example item' })
  @ApiCreatedResponse({ description: 'The created example item' })
  create(@Body() dto: CreateExampleItemDto) {
    return this.exampleItemsService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an example item' })
  @ApiOkResponse({ description: 'The requested example item' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.exampleItemsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an example item' })
  @ApiOkResponse({ description: 'The updated example item' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateExampleItemDto,
  ) {
    return this.exampleItemsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an example item' })
  @ApiNoContentResponse({ description: 'The item was deleted' })
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.exampleItemsService.remove(id);
  }
}
