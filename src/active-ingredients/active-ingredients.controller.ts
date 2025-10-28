import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ActiveIngredientsService } from './active-ingredients.service';
import { PaginationDto } from '../common/dtos/pagination.dto';
import { ActiveIngredientDto } from './dto/active-ingredient.dto';

@ApiTags('active-ingredients')
@Controller('api/active-ingredients')
export class ActiveIngredientsController {
  constructor(private readonly activeIngredientsService: ActiveIngredientsService) { }

  @Get()
  @ApiOperation({
    summary: 'Get all active ingredients',
    description: 'Get a paginated list of all active ingredients with medicine counts'
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of active ingredients',
    schema: {
      type: 'object',
      properties: {
        activeIngredients: { type: 'array', items: { $ref: '#/components/schemas/ActiveIngredientDto' } },
        total: { type: 'number', description: 'Total number of active ingredients' },
        page: { type: 'number', description: 'Current page number' },
        limit: { type: 'number', description: 'Number of items per page' }
      }
    }
  })
  async findAll(@Query() paginationDto: PaginationDto) {
    return await this.activeIngredientsService.findAll(paginationDto);
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search active ingredients',
    description: 'Search active ingredients by name using fuzzy matching'
  })
  @ApiQuery({
    name: 'q',
    description: 'Search query',
    example: 'azithromycin'
  })
  @ApiQuery({
    name: 'limit',
    description: 'Maximum number of results',
    required: false,
    example: 20
  })
  @ApiResponse({
    status: 200,
    description: 'List of matching active ingredients',
    type: [ActiveIngredientDto]
  })
  async search(
    @Query('q') query: string,
    @Query('limit') limit?: number
  ): Promise<ActiveIngredientDto[]> {
    return await this.activeIngredientsService.search(query, limit);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get active ingredient details',
    description: 'Get detailed information about a specific active ingredient'
  })
  @ApiParam({
    name: 'id',
    description: 'Active ingredient ID',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({
    status: 200,
    description: 'Active ingredient details',
    type: ActiveIngredientDto
  })
  @ApiResponse({ status: 404, description: 'Active ingredient not found' })
  async findOne(@Param('id') id: string): Promise<ActiveIngredientDto> {
    return await this.activeIngredientsService.findOne(id);
  }
}
