import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { WarehouseResponseDto } from './dto/warehouse-response.dto';
import { CreateStockMovementDto } from './dto/stock-movement.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { InventoryItemResponseDto } from './dto/inventory-item.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { PaginationDto } from '../common/dtos/pagination.dto';
import { UserRole } from '@prisma/client';

@ApiTags('inventory')
@Controller('api/inventory')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('warehouses')
  @UseGuards(RolesGuard)
  @Roles(UserRole.PHARMACY_ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Create warehouse',
    description: 'Create a new warehouse (requires PHARMACY_ADMIN, MANAGER, or SUPER_ADMIN role)',
  })
  @ApiResponse({
    status: 201,
    description: 'Warehouse created successfully',
    type: WarehouseResponseDto,
  })
  async createWarehouse(
    @Body() createWarehouseDto: CreateWarehouseDto,
    @CurrentTenant() tenantId: string,
  ): Promise<WarehouseResponseDto> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }
    return this.inventoryService.createWarehouse(
      createWarehouseDto,
      tenantId,
    );
  }

  @Get('warehouses')
  @ApiOperation({
    summary: 'List warehouses',
    description: 'Get all warehouses for the current tenant',
  })
  @ApiResponse({
    status: 200,
    description: 'List of warehouses',
    type: [WarehouseResponseDto],
  })
  async findAllWarehouses(
    @CurrentTenant() tenantId: string,
    @Query() paginationDto?: PaginationDto,
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }
    return this.inventoryService.findAllWarehouses(tenantId, paginationDto);
  }

  @Get('warehouses/:id')
  @ApiOperation({
    summary: 'Get warehouse details',
    description: 'Get warehouse by ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Warehouse ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Warehouse details',
    type: WarehouseResponseDto,
  })
  async findWarehouseById(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<WarehouseResponseDto> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }
    return this.inventoryService.findWarehouseById(id, tenantId);
  }

  @Get('items')
  @ApiOperation({
    summary: 'List inventory items',
    description: 'Get inventory items with optional filters',
  })
  @ApiQuery({
    name: 'warehouseId',
    required: false,
    description: 'Filter by warehouse ID',
  })
  @ApiQuery({
    name: 'medicineId',
    required: false,
    description: 'Filter by medicine ID',
  })
  @ApiQuery({
    name: 'lowStock',
    required: false,
    description: 'Show only low stock items',
    type: Boolean,
  })
  @ApiResponse({
    status: 200,
    description: 'List of inventory items',
    type: [InventoryItemResponseDto],
  })
  async findInventoryItems(
    @CurrentTenant() tenantId: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('medicineId') medicineId?: string,
    @Query('lowStock') lowStock?: boolean,
    @Query() paginationDto?: PaginationDto,
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }
    return this.inventoryService.findInventoryItems(
      tenantId,
      warehouseId,
      medicineId,
      lowStock === true,
      paginationDto,
    );
  }

  @Get('items/:id')
  @ApiOperation({
    summary: 'Get inventory item details',
    description: 'Get inventory item by ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Inventory item ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Inventory item details',
    type: InventoryItemResponseDto,
  })
  async findInventoryItemById(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<InventoryItemResponseDto> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }
    return this.inventoryService.findInventoryItemById(id, tenantId);
  }

  @Post('items/:id/adjust')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.PHARMACIST,
    UserRole.PHARMACY_ADMIN,
    UserRole.MANAGER,
    UserRole.SUPER_ADMIN,
  )
  @ApiOperation({
    summary: 'Adjust stock quantity',
    description: 'Adjust stock quantity for an inventory item (requires PHARMACIST or higher role)',
  })
  @ApiParam({
    name: 'id',
    description: 'Inventory item ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Stock adjusted successfully',
    type: InventoryItemResponseDto,
  })
  async adjustStock(
    @Param('id') id: string,
    @Body() adjustStockDto: AdjustStockDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<InventoryItemResponseDto> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }
    return this.inventoryService.adjustStock(
      id,
      adjustStockDto,
      tenantId,
      user.sub,
    );
  }

  @Post('movements')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.PHARMACIST,
    UserRole.PHARMACY_ADMIN,
    UserRole.MANAGER,
    UserRole.SUPER_ADMIN,
  )
  @ApiOperation({
    summary: 'Record stock movement',
    description: 'Record a stock movement (IN, OUT, TRANSFER, etc.)',
  })
  @ApiResponse({
    status: 201,
    description: 'Stock movement recorded successfully',
  })
  async createStockMovement(
    @Body() createStockMovementDto: CreateStockMovementDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }
    return this.inventoryService.createStockMovement(
      createStockMovementDto,
      tenantId,
      user.sub,
    );
  }

  @Get('movements')
  @ApiOperation({
    summary: 'List stock movements',
    description: 'Get stock movements with optional filters',
  })
  @ApiQuery({
    name: 'warehouseId',
    required: false,
    description: 'Filter by warehouse ID',
  })
  @ApiQuery({
    name: 'inventoryItemId',
    required: false,
    description: 'Filter by inventory item ID',
  })
  @ApiResponse({
    status: 200,
    description: 'List of stock movements',
  })
  async findStockMovements(
    @CurrentTenant() tenantId: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('inventoryItemId') inventoryItemId?: string,
    @Query() paginationDto?: PaginationDto,
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }
    return this.inventoryService.findStockMovements(
      tenantId,
      warehouseId,
      inventoryItemId,
      paginationDto,
    );
  }

  @Get('low-stock')
  @ApiOperation({
    summary: 'Get low stock items',
    description: 'Get inventory items below reorder point',
  })
  @ApiResponse({
    status: 200,
    description: 'List of low stock items',
  })
  async findLowStockItems(@CurrentTenant() tenantId: string) {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }
    return this.inventoryService.findLowStockItems(tenantId);
  }
}

