import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ParseEnumPipe,
  ParseDatePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { SalesService } from './sales.service';
import { ReceiptService } from './services/receipt.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SaleResponseDto } from './dto/sale-response.dto';
import { ReceiptDto } from './dto/receipt.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { PaginationDto } from '../common/dtos/pagination.dto';
import { SaleStatus, PaymentMethod, UserRole } from '@prisma/client';

@ApiTags('sales')
@Controller('api/sales')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SalesController {
  constructor(
    private readonly salesService: SalesService,
    private readonly receiptService: ReceiptService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create new sale (POS transaction)',
    description: 'Create a new sale with automatic stock deduction',
  })
  @ApiResponse({
    status: 201,
    description: 'Sale created successfully',
    type: SaleResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input or insufficient stock',
  })
  async createSale(
    @Body() createSaleDto: CreateSaleDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<SaleResponseDto> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }
    return this.salesService.createSale(
      createSaleDto,
      tenantId,
      user.sub,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'List sales',
    description: 'Get paginated list of sales with optional filters',
  })
  @ApiQuery({
    name: 'warehouseId',
    required: false,
    description: 'Filter by warehouse ID',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: SaleStatus,
    description: 'Filter by sale status',
  })
  @ApiQuery({
    name: 'paymentMethod',
    required: false,
    enum: PaymentMethod,
    description: 'Filter by payment method',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Filter from date (ISO format)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'Filter to date (ISO format)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of sales',
  })
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('status') status?: SaleStatus,
    @Query('paymentMethod') paymentMethod?: PaymentMethod,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query() paginationDto?: PaginationDto,
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const startDateParsed = startDate ? new Date(startDate) : undefined;
    const endDateParsed = endDate ? new Date(endDate) : undefined;

    return this.salesService.findAll(
      tenantId,
      warehouseId,
      status,
      paymentMethod,
      startDateParsed,
      endDateParsed,
      paginationDto,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get sale details',
    description: 'Get sale by ID with all items',
  })
  @ApiParam({
    name: 'id',
    description: 'Sale ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Sale details',
    type: SaleResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Sale not found',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<SaleResponseDto> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }
    return this.salesService.findOne(id, tenantId);
  }

  @Post(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.PHARMACY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Cancel sale',
    description: 'Cancel a sale and restore stock (requires MANAGER or higher role)',
  })
  @ApiParam({
    name: 'id',
    description: 'Sale ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Sale cancelled successfully',
    type: SaleResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Sale cannot be cancelled',
  })
  async cancelSale(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<SaleResponseDto> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }
    return this.salesService.cancelSale(id, tenantId, user.sub);
  }

  @Get(':id/receipt')
  @ApiOperation({
    summary: 'Get sale receipt',
    description: 'Generate receipt data for a sale',
  })
  @ApiParam({
    name: 'id',
    description: 'Sale ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Receipt data',
    type: ReceiptDto,
  })
  async getReceipt(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<ReceiptDto> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }
    return this.receiptService.generateReceipt(id, tenantId);
  }

  @Get('stats/overview')
  @ApiOperation({
    summary: 'Get sales statistics',
    description: 'Get sales statistics (total sales, revenue, averages, etc.)',
  })
  @ApiQuery({
    name: 'warehouseId',
    required: false,
    description: 'Filter by warehouse ID',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Filter from date (ISO format)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'Filter to date (ISO format)',
  })
  @ApiResponse({
    status: 200,
    description: 'Sales statistics',
  })
  async getStatistics(
    @CurrentTenant() tenantId: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const startDateParsed = startDate ? new Date(startDate) : undefined;
    const endDateParsed = endDate ? new Date(endDate) : undefined;

    return this.salesService.getStatistics(
      tenantId,
      warehouseId,
      startDateParsed,
      endDateParsed,
    );
  }
}

