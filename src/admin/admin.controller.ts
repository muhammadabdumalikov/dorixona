import {
  Controller,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Get,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import {
  UpdatePriceDto,
  BulkUpdatePricesDto,
  UpdateMedicineDto,
} from './dto/update-price.dto';

@ApiTags('admin')
@Controller('api/admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) { }

  @Put('medicines/:id/price')
  @ApiOperation({
    summary: 'Update medicine price',
    description: 'Update the price of a specific medicine',
  })
  @ApiParam({
    name: 'id',
    description: 'Medicine ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({ status: 200, description: 'Price updated successfully' })
  @ApiResponse({ status: 404, description: 'Medicine not found' })
  async updateMedicinePrice(
    @Param('id') id: string,
    @Body() updatePriceDto: UpdatePriceDto,
  ): Promise<void> {
    return await this.adminService.updateMedicinePrice(id, updatePriceDto);
  }

  @Put('medicines/prices/bulk')
  @ApiOperation({
    summary: 'Bulk update medicine prices',
    description: 'Update prices for multiple medicines at once',
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk update completed',
    schema: {
      type: 'object',
      properties: {
        updated: {
          type: 'number',
          description: 'Number of successfully updated medicines',
        },
        failed: { type: 'number', description: 'Number of failed updates' },
        errors: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of errors',
        },
      },
    },
  })
  async bulkUpdatePrices(@Body() bulkUpdatePricesDto: BulkUpdatePricesDto) {
    return await this.adminService.bulkUpdatePrices(bulkUpdatePricesDto);
  }

  @Put('medicines/:id')
  @ApiOperation({
    summary: 'Update medicine details',
    description: 'Update medicine information',
  })
  @ApiParam({
    name: 'id',
    description: 'Medicine ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({ status: 200, description: 'Medicine updated successfully' })
  @ApiResponse({ status: 404, description: 'Medicine not found' })
  async updateMedicine(
    @Param('id') id: string,
    @Body() updateMedicineDto: UpdateMedicineDto,
  ): Promise<void> {
    return await this.adminService.updateMedicine(id, updateMedicineDto);
  }

  @Patch('medicines/:id/availability')
  @ApiOperation({
    summary: 'Toggle medicine availability',
    description: 'Toggle the availability status of a medicine',
  })
  @ApiParam({
    name: 'id',
    description: 'Medicine ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Availability toggled successfully',
  })
  @ApiResponse({ status: 404, description: 'Medicine not found' })
  async toggleAvailability(@Param('id') id: string): Promise<void> {
    return await this.adminService.toggleAvailability(id);
  }

  @Delete('medicines/:id')
  @ApiOperation({
    summary: 'Soft delete medicine',
    description: 'Soft delete a medicine (mark as unavailable)',
  })
  @ApiParam({
    name: 'id',
    description: 'Medicine ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Medicine soft deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Medicine not found' })
  async softDeleteMedicine(@Param('id') id: string): Promise<void> {
    return await this.adminService.softDeleteMedicine(id);
  }

  @Get('statistics')
  @ApiOperation({
    summary: 'Get import statistics',
    description: 'Get statistics about the imported data',
  })
  @ApiResponse({
    status: 200,
    description: 'Import statistics',
    schema: {
      type: 'object',
      properties: {
        totalMedicines: {
          type: 'number',
          description: 'Total number of medicines',
        },
        totalActiveIngredients: {
          type: 'number',
          description: 'Total number of active ingredients',
        },
        totalManufacturers: {
          type: 'number',
          description: 'Total number of manufacturers',
        },
        totalDosageForms: {
          type: 'number',
          description: 'Total number of dosage forms',
        },
        medicinesWithPrices: {
          type: 'number',
          description: 'Number of medicines with prices',
        },
        lastImportDate: {
          type: 'string',
          format: 'date-time',
          description: 'Last import date',
        },
      },
    },
  })
  async getImportStatistics() {
    return await this.adminService.getImportStatistics();
  }

  @Get('database-status')
  @ApiOperation({
    summary: 'Check database connection and schema',
    description: 'Check if database is connected and has the correct schema',
  })
  @ApiResponse({
    status: 200,
    description: 'Database status information',
    schema: {
      type: 'object',
      properties: {
        connected: { type: 'boolean', description: 'Database connection status' },
        tables: { type: 'array', items: { type: 'string' }, description: 'Available tables' },
        error: { type: 'string', description: 'Error message if any' }
      }
    }
  })
  async getDatabaseStatus() {
    return await this.adminService.getDatabaseStatus();
  }
}
