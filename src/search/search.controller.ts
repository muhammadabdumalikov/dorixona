import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchDto } from './dto/search.dto';
import { MedicineResponseDto } from './dto/medicine-response.dto';

@ApiTags('search')
@Controller('api/search')
export class SearchController {
  constructor(private readonly searchService: SearchService) { }

  @Post()
  @ApiOperation({
    summary: 'Search medicines',
    description: 'Search for medicines by trade name or active ingredient using fuzzy matching'
  })
  @ApiResponse({
    status: 200,
    description: 'Search results',
    type: [MedicineResponseDto]
  })
  async searchMedicines(@Body() searchDto: SearchDto): Promise<MedicineResponseDto[]> {
    return await this.searchService.searchMedicines(searchDto);
  }

  @Get('by-ingredient')
  @ApiOperation({
    summary: 'Search medicines by active ingredient',
    description: 'Find all medicines containing a specific active ingredient'
  })
  @ApiQuery({
    name: 'ingredient',
    description: 'Active ingredient name',
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
    description: 'Medicines containing the ingredient',
    type: [MedicineResponseDto]
  })
  async searchByIngredient(
    @Query('ingredient') ingredient: string,
    @Query('limit') limit?: number
  ): Promise<MedicineResponseDto[]> {
    return await this.searchService.searchByActiveIngredient(ingredient, limit);
  }
}
