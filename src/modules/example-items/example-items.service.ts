import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.module';
import { CreateExampleItemDto } from './dto/create-example-item.dto';
import { ListExampleItemsDto } from './dto/list-example-items.dto';
import { UpdateExampleItemDto } from './dto/update-example-item.dto';

@Injectable()
export class ExampleItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListExampleItemsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();
    const where: Prisma.ExampleItemWhereInput = search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.exampleItem.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.exampleItem.count({ where }),
    ]);

    return {
      data: items,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  async create(dto: CreateExampleItemDto) {
    return this.prisma.exampleItem.create({ data: dto });
  }

  async findOne(id: string) {
    const item = await this.prisma.exampleItem.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Example item ${id} was not found`);
    }

    return item;
  }

  async update(id: string, dto: UpdateExampleItemDto) {
    await this.findOne(id);
    return this.prisma.exampleItem.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.exampleItem.delete({ where: { id } });
  }
}
