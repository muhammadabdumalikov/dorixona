import { Controller, Post, HttpCode, HttpStatus, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ImportService, ImportResult } from './import.service';

@ApiTags('admin')
@Controller('api/admin')
export class ImportController {
  constructor(private readonly importService: ImportService) { }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Import medicines from Excel files',
    description:
      'Processes all Excel files in the public directory and imports medicine data into the database',
  })
  @ApiResponse({
    status: 200,
    description: 'Import completed successfully',
    schema: {
      type: 'object',
      properties: {
        totalProcessed: { type: 'number', description: 'Total rows processed' },
        created: { type: 'number', description: 'New medicines created' },
        skipped: {
          type: 'number',
          description: 'Rows skipped (duplicates or invalid)',
        },
        errors: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of errors encountered',
        },
      },
    },
  })
  @ApiResponse({ status: 500, description: 'Import failed' })
  async importMedicines(): Promise<ImportResult> {
    return await this.importService.importMedicines();
  }

  @Post('scrape-arzon')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Manually trigger ArzonApteka scraping and price update',
    description:
      'Manually triggers the scraping flow: 1) Gets medicines from database needing price updates, 2) Searches ArzonApteka for each, 3) Uses OpenAI to analyze and match medicines, 4) Updates prices. Note: This also runs automatically every 10 seconds via cron job.',
  })
  @ApiResponse({
    status: 200,
    description: 'Scraping completed successfully',
    schema: {
      type: 'object',
      properties: {
        totalProcessed: { type: 'number', description: 'Total medicines processed' },
        created: { type: 'number', description: 'Prices updated successfully' },
        skipped: {
          type: 'number',
          description: 'Medicines skipped (no match or no price found)',
        },
        errors: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of errors encountered',
        },
      },
    },
  })
  @ApiResponse({ status: 500, description: 'Scraping failed' })
  async scrapeArzonApteka(@Body() body?: { search?: string }): Promise<ImportResult> {
    // searchTerm parameter is kept for backward compatibility but not used in new flow
    return await this.importService.scrapeArzonApteka();
  }
}
