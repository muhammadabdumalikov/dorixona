import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { MedicinesService } from './medicines.service';
import { PaginationDto } from '../common/dtos/pagination.dto';
import { MedicineResponseDto } from './dto/medicine-response.dto';
import { MedicineDetailDto } from './dto/medicine-detail.dto';

@ApiTags('medicines')
@Controller('api/medicines')
export class MedicinesController {
  constructor(private readonly medicinesService: MedicinesService) { }

  @Get()
  @ApiOperation({
    summary: 'Get all medicines',
    description: 'Get a paginated list of all available medicines'
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of medicines',
    schema: {
      type: 'object',
      properties: {
        medicines: { type: 'array', items: { $ref: '#/components/schemas/MedicineResponseDto' } },
        total: { type: 'number', description: 'Total number of medicines' },
        page: { type: 'number', description: 'Current page number' },
        limit: { type: 'number', description: 'Number of items per page' }
      }
    }
  })
  async findAll(@Query() paginationDto: PaginationDto) {
    return await this.medicinesService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get medicine details',
    description: 'Get detailed information about a specific medicine including active ingredients and manufacturer'
  })
  @ApiParam({
    name: 'id',
    description: 'Medicine ID',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({
    status: 200,
    description: 'Detailed medicine information',
    type: MedicineDetailDto
  })
  @ApiResponse({ status: 404, description: 'Medicine not found' })
  async findOne(@Param('id') id: string): Promise<MedicineDetailDto> {
    return await this.medicinesService.findOne(id);
  }

  @Get('by-ingredient/:ingredientId')
  @ApiOperation({
    summary: 'Get medicines by active ingredient',
    description: 'Get all medicines containing a specific active ingredient'
  })
  @ApiParam({
    name: 'ingredientId',
    description: 'Active ingredient ID',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of medicines containing the ingredient',
    schema: {
      type: 'object',
      properties: {
        medicines: { type: 'array', items: { $ref: '#/components/schemas/MedicineResponseDto' } },
        total: { type: 'number', description: 'Total number of medicines' },
        page: { type: 'number', description: 'Current page number' },
        limit: { type: 'number', description: 'Number of items per page' }
      }
    }
  })
  async findByIngredient(
    @Param('ingredientId') ingredientId: string,
    @Query() paginationDto: PaginationDto
  ) {
    return await this.medicinesService.findByIngredient(ingredientId, paginationDto);
  }
}
