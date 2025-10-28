import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AlternativesService } from './alternatives.service';
import { AlternativeDto } from './dto/alternative.dto';

@ApiTags('alternatives')
@Controller('api/medicines')
export class AlternativesController {
  constructor(private readonly alternativesService: AlternativesService) { }

  @Get(':id/alternatives')
  @ApiOperation({
    summary: 'Find medicine alternatives',
    description: 'Find cheaper alternatives to a medicine based on active ingredients, dosage form, and strength'
  })
  @ApiParam({
    name: 'id',
    description: 'Medicine ID',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiQuery({
    name: 'limit',
    description: 'Maximum number of alternatives to return',
    required: false,
    example: 10
  })
  @ApiResponse({
    status: 200,
    description: 'List of alternative medicines with comparison data',
    type: [AlternativeDto]
  })
  @ApiResponse({ status: 404, description: 'Medicine not found' })
  async findAlternatives(
    @Param('id') id: string,
    @Query('limit') limit?: number
  ): Promise<AlternativeDto[]> {
    return await this.alternativesService.findAlternatives(id);
  }

  @Get(':id/cheapest-alternatives')
  @ApiOperation({
    summary: 'Find cheapest alternatives',
    description: 'Find the cheapest alternatives to a medicine, sorted by price'
  })
  @ApiParam({
    name: 'id',
    description: 'Medicine ID',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiQuery({
    name: 'limit',
    description: 'Maximum number of cheapest alternatives to return',
    required: false,
    example: 5
  })
  @ApiResponse({
    status: 200,
    description: 'List of cheapest alternative medicines',
    type: [AlternativeDto]
  })
  @ApiResponse({ status: 404, description: 'Medicine not found' })
  async findCheapestAlternatives(
    @Param('id') id: string,
    @Query('limit') limit?: number
  ): Promise<AlternativeDto[]> {
    return await this.alternativesService.findCheapestAlternatives(id, limit);
  }
}
