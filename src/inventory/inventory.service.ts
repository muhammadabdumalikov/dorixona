import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { WarehouseResponseDto } from './dto/warehouse-response.dto';
import { CreateStockMovementDto } from './dto/stock-movement.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { InventoryItemResponseDto } from './dto/inventory-item.dto';
import { StockMovementType, UserRole } from '@prisma/client';
import { PaginationDto } from '../common/dtos/pagination.dto';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new warehouse
   */
  async createWarehouse(
    createWarehouseDto: CreateWarehouseDto,
    tenantId: string,
  ): Promise<WarehouseResponseDto> {
    const warehouse = await this.prisma.warehouse.create({
      data: {
        ...createWarehouseDto,
        tenant_id: tenantId,
        is_active: true,
      },
    });

    this.logger.log(`Warehouse created: ${warehouse.id}`);
    return warehouse;
  }

  /**
   * Get all warehouses for a tenant
   */
  async findAllWarehouses(
    tenantId: string,
    paginationDto?: PaginationDto,
  ): Promise<{
    warehouses: WarehouseResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = paginationDto?.page || 1;
    const limit = paginationDto?.limit || 10;
    const skip = (page - 1) * limit;

    const [warehouses, total] = await Promise.all([
      this.prisma.warehouse.findMany({
        where: {
          tenant_id: tenantId,
          is_active: true,
        },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.warehouse.count({
        where: {
          tenant_id: tenantId,
          is_active: true,
        },
      }),
    ]);

    return {
      warehouses,
      total,
      page,
      limit,
    };
  }

  /**
   * Get warehouse by ID
   */
  async findWarehouseById(
    id: string,
    tenantId: string,
  ): Promise<WarehouseResponseDto> {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: {
        id,
        tenant_id: tenantId,
      },
    });

    if (!warehouse) {
      throw new NotFoundException(`Warehouse with ID ${id} not found`);
    }

    return warehouse;
  }

  /**
   * Get inventory items with filters
   */
  async findInventoryItems(
    tenantId: string,
    warehouseId?: string,
    medicineId?: string,
    lowStock?: boolean,
    paginationDto?: PaginationDto,
  ): Promise<{
    items: InventoryItemResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = paginationDto?.page || 1;
    const limit = paginationDto?.limit || 10;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      warehouse: {
        tenant_id: tenantId,
      },
    };

    if (warehouseId) {
      where.warehouse_id = warehouseId;
    }

    if (medicineId) {
      where.medicine_id = medicineId;
    }

    if (lowStock) {
      where.quantity = {
        lte: this.prisma.$queryRaw`COALESCE(reorder_point, 0)`,
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where,
        include: {
          medicine: {
            select: {
              id: true,
              trade_name: true,
              strength: true,
              package_size: true,
            },
          },
          warehouse: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { updated_at: 'desc' },
      }),
      this.prisma.inventoryItem.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
    };
  }

  /**
   * Get inventory item by ID
   */
  async findInventoryItemById(
    id: string,
    tenantId: string,
  ): Promise<InventoryItemResponseDto> {
    const item = await this.prisma.inventoryItem.findFirst({
      where: {
        id,
        warehouse: {
          tenant_id: tenantId,
        },
      },
      include: {
        medicine: {
          select: {
            id: true,
            trade_name: true,
            strength: true,
            package_size: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException(`Inventory item with ID ${id} not found`);
    }

    return item as InventoryItemResponseDto;
  }

  /**
   * Adjust stock quantity
   */
  async adjustStock(
    id: string,
    adjustStockDto: AdjustStockDto,
    tenantId: string,
    userId: string,
  ): Promise<InventoryItemResponseDto> {
    const item = await this.findInventoryItemById(id, tenantId);

    const oldQuantity = item.quantity;
    const newQuantity = adjustStockDto.quantity;
    const difference = newQuantity - oldQuantity;

    if (difference === 0) {
      throw new BadRequestException('New quantity is the same as current quantity');
    }

    // Update inventory item
    const updatedItem = await this.prisma.inventoryItem.update({
      where: { id },
      data: {
        quantity: newQuantity,
      },
      include: {
        medicine: {
          select: {
            id: true,
            trade_name: true,
            strength: true,
            package_size: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    // Record stock movement
    await this.prisma.stockMovement.create({
      data: {
        inventory_item_id: id,
        warehouse_id: item.warehouse_id,
        movement_type: StockMovementType.ADJUSTMENT,
        quantity: Math.abs(difference),
        notes: adjustStockDto.notes || `Stock adjusted from ${oldQuantity} to ${newQuantity}`,
        created_by: userId,
      },
    });

    this.logger.log(
      `Stock adjusted for item ${id}: ${oldQuantity} -> ${newQuantity}`,
    );

    return updatedItem as InventoryItemResponseDto;
  }

  /**
   * Record stock movement
   */
  async createStockMovement(
    createStockMovementDto: CreateStockMovementDto,
    tenantId: string,
    userId: string,
  ) {
    // Verify warehouse belongs to tenant
    const warehouse = await this.prisma.warehouse.findFirst({
      where: {
        id: createStockMovementDto.warehouse_id,
        tenant_id: tenantId,
      },
    });

    if (!warehouse) {
      throw new NotFoundException('Warehouse not found or access denied');
    }

    // Verify inventory item exists and belongs to warehouse
    const inventoryItem = await this.prisma.inventoryItem.findFirst({
      where: {
        id: createStockMovementDto.inventory_item_id,
        warehouse_id: createStockMovementDto.warehouse_id,
      },
    });

    if (!inventoryItem) {
      throw new NotFoundException('Inventory item not found');
    }

    // Calculate new quantity based on movement type
    let newQuantity = inventoryItem.quantity;
    if (createStockMovementDto.movement_type === StockMovementType.IN) {
      newQuantity += createStockMovementDto.quantity;
    } else if (createStockMovementDto.movement_type === StockMovementType.OUT) {
      newQuantity -= createStockMovementDto.quantity;
      if (newQuantity < 0) {
        throw new BadRequestException('Insufficient stock');
      }
    } else if (createStockMovementDto.movement_type === StockMovementType.ADJUSTMENT) {
      // For adjustments, we use the quantity directly
      newQuantity = createStockMovementDto.quantity;
    }

    // Update inventory item
    await this.prisma.inventoryItem.update({
      where: { id: inventoryItem.id },
      data: { quantity: newQuantity },
    });

    // Record stock movement
    const movement = await this.prisma.stockMovement.create({
      data: {
        ...createStockMovementDto,
        created_by: userId,
      },
    });

    this.logger.log(
      `Stock movement recorded: ${createStockMovementDto.movement_type} ${createStockMovementDto.quantity} units for item ${inventoryItem.id}`,
    );

    return movement;
  }

  /**
   * Get stock movements with pagination
   */
  async findStockMovements(
    tenantId: string,
    warehouseId?: string,
    inventoryItemId?: string,
    paginationDto?: PaginationDto,
  ) {
    const page = paginationDto?.page || 1;
    const limit = paginationDto?.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {
      warehouse: {
        tenant_id: tenantId,
      },
    };

    if (warehouseId) {
      where.warehouse_id = warehouseId;
    }

    if (inventoryItemId) {
      where.inventory_item_id = inventoryItemId;
    }

    const [movements, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        include: {
          inventory_item: {
            include: {
              medicine: {
                select: {
                  id: true,
                  trade_name: true,
                },
              },
            },
          },
          user: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return {
      movements,
      total,
      page,
      limit,
    };
  }

  /**
   * Get low stock items (below reorder point)
   */
  async findLowStockItems(tenantId: string) {
    const warehouses = await this.prisma.warehouse.findMany({
      where: { tenant_id: tenantId },
      select: { id: true },
    });

    const warehouseIds = warehouses.map((w) => w.id);

    if (warehouseIds.length === 0) {
      return [];
    }

    // Get all inventory items for tenant's warehouses
    const items = await this.prisma.inventoryItem.findMany({
      where: {
        warehouse_id: { in: warehouseIds },
      },
      include: {
        medicine: {
          select: {
            id: true,
            trade_name: true,
            strength: true,
            package_size: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    // Filter items where quantity <= reorder_point
    const lowStockItems = items.filter((item) => {
      const reorderPoint = item.reorder_point ?? 0;
      return item.quantity <= reorderPoint;
    });

    // Sort by quantity ascending, then by reorder_point descending
    return lowStockItems.sort((a, b) => {
      if (a.quantity !== b.quantity) {
        return a.quantity - b.quantity;
      }
      const aReorder = a.reorder_point ?? 0;
      const bReorder = b.reorder_point ?? 0;
      return bReorder - aReorder;
    });
  }
}

