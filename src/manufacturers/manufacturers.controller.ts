import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ManufacturersService } from './manufacturers.service';
import { PaginationDto } from '../common/dtos/pagination.dto';
import { ManufacturerDto } from './dto/manufacturer.dto';

@ApiTags('manufacturers')
@Controller('api/manufacturers')
export class ManufacturersController {
  constructor(private readonly manufacturersService: ManufacturersService) { }

  @Get()
  @ApiOperation({
    summary: 'Get all manufacturers',
    description: 'Get a paginated list of all manufacturers with medicine counts'
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of manufacturers',
    schema: {
      type: 'object',
      properties: {
        manufacturers: { type: 'array', items: { $ref: '#/components/schemas/ManufacturerDto' } },
        total: { type: 'number', description: 'Total number of manufacturers' },
        page: { type: 'number', description: 'Current page number' },
        limit: { type: 'number', description: 'Number of items per page' }
      }
    }
  })
  async findAll(@Query() paginationDto: PaginationDto) {
    return await this.manufacturersService.findAll(paginationDto);
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search manufacturers',
    description: 'Search manufacturers by name or country using fuzzy matching'
  })
  @ApiQuery({
    name: 'q',
    description: 'Search query',
    example: 'teva'
  })
  @ApiQuery({
    name: 'limit',
    description: 'Maximum number of results',
    required: false,
    example: 20
  })
  @ApiResponse({
    status: 200,
    description: 'List of matching manufacturers',
    type: [ManufacturerDto]
  })
  async search(
    @Query('q') query: string,
    @Query('limit') limit?: number
  ): Promise<ManufacturerDto[]> {
    return await this.manufacturersService.search(query, limit);
  }

  @Get('local')
  @ApiOperation({
    summary: 'Get local manufacturers',
    description: 'Get all Uzbek manufacturers'
  })
  @ApiResponse({
    status: 200,
    description: 'List of local manufacturers',
    type: [ManufacturerDto]
  })
  async getLocalManufacturers(): Promise<ManufacturerDto[]> {
    return await this.manufacturersService.getLocalManufacturers();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get manufacturer details',
    description: 'Get detailed information about a specific manufacturer'
  })
  @ApiParam({
    name: 'id',
    description: 'Manufacturer ID',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({
    status: 200,
    description: 'Manufacturer details',
    type: ManufacturerDto
  })
  @ApiResponse({ status: 404, description: 'Manufacturer not found' })
  async findOne(@Param('id') id: string): Promise<ManufacturerDto> {
    return await this.manufacturersService.findOne(id);
  }
}
