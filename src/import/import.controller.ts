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
    summary: 'Manually trigger ArzonApteka scraping',
    description:
      'Manually triggers the Puppeteer-based scraping of ArzonApteka API. Note: This also runs automatically every 10 seconds via cron job.',
  })
  @ApiResponse({
    status: 200,
    description: 'Scraping completed successfully',
    schema: {
      type: 'object',
      properties: {
        totalProcessed: { type: 'number', description: 'Total items processed' },
        created: { type: 'number', description: 'New medicines created' },
        skipped: {
          type: 'number',
          description: 'Items skipped (duplicates or invalid)',
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
    const searchTerm = body?.search || 'midaks';
    return await this.importService.scrapeArzonApteka(searchTerm);
  }
}
