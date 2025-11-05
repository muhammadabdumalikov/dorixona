import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SaleResponseDto } from './dto/sale-response.dto';
import { SaleStatus, StockMovementType, PaymentMethod } from '@prisma/client';
import { PaginationDto } from '../common/dtos/pagination.dto';
@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Generate unique sale number
   * Format: SALE-YYYYMMDD-XXXX (where XXXX is sequential number for the day)
   */
  private async generateSaleNumber(tenantId: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    const prefix = `SALE-${dateStr}`;

    // Count existing sales for today
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const count = await this.prisma.sale.count({
      where: {
        tenant_id: tenantId,
        created_at: {
          gte: startOfDay,
          lte: endOfDay,
        },
        sale_number: {
          startsWith: prefix,
        },
      },
    });

    const sequence = String(count + 1).padStart(4, '0');
    return `${prefix}-${sequence}`;
  }

  /**
   * Calculate item subtotal with discount and tax
   */
  private calculateItemSubtotal(
    quantity: number,
    unitPrice: number,
    discountPercent?: number,
    discountAmount?: number,
    taxPercent?: number,
  ): {
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
  } {
    const baseAmount = quantity * unitPrice;

    // Calculate discount
    let finalDiscountAmount = 0;
    if (discountAmount !== undefined && discountAmount > 0) {
      finalDiscountAmount = discountAmount;
    } else if (discountPercent !== undefined && discountPercent > 0) {
      finalDiscountAmount = (baseAmount * discountPercent) / 100;
    }

    const amountAfterDiscount = baseAmount - finalDiscountAmount;

    // Calculate tax
    let taxAmount = 0;
    if (taxPercent !== undefined && taxPercent > 0) {
      taxAmount = (amountAfterDiscount * taxPercent) / 100;
    }

    const subtotal = amountAfterDiscount + taxAmount;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      discountAmount: Math.round(finalDiscountAmount * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
    };
  }

  /**
   * Create a new sale (POS transaction)
   */
  async createSale(
    createSaleDto: CreateSaleDto,
    tenantId: string,
    userId: string,
  ): Promise<SaleResponseDto> {
    // Validate warehouse belongs to tenant
    const warehouse = await this.prisma.warehouse.findFirst({
      where: {
        id: createSaleDto.warehouse_id,
        tenant_id: tenantId,
      },
    });

    if (!warehouse || !warehouse.is_active) {
      throw new NotFoundException('Warehouse not found or inactive');
    }

    // Validate all items and check stock availability
    const validatedItems = [];
    let totalAmount = 0;
    let totalDiscountAmount = 0;
    let totalTaxAmount = 0;

    for (const item of createSaleDto.items) {
      // Get inventory item
      const inventoryItem = await this.prisma.inventoryItem.findFirst({
        where: {
          id: item.inventory_item_id,
          warehouse_id: createSaleDto.warehouse_id,
        },
        include: {
          medicine: true,
        },
      });

      if (!inventoryItem) {
        throw new NotFoundException(
          `Inventory item ${item.inventory_item_id} not found in warehouse`,
        );
      }

      // Check stock availability
      const availableStock =
        inventoryItem.quantity - inventoryItem.reserved_qty;
      if (availableStock < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for ${inventoryItem.medicine.trade_name}. Available: ${availableStock}, Requested: ${item.quantity}`,
        );
      }

      // Use selling price from inventory or provided price
      const unitPrice =
        item.unit_price ?? Number(inventoryItem.selling_price ?? 0);
      if (unitPrice <= 0) {
        throw new BadRequestException(
          `Invalid unit price for ${inventoryItem.medicine.trade_name}`,
        );
      }

      // Calculate item subtotal
      const calculation = this.calculateItemSubtotal(
        item.quantity,
        unitPrice,
        item.discount_percent,
        item.discount_amount,
        item.tax_percent,
      );

      validatedItems.push({
        inventoryItem,
        item,
        unitPrice,
        ...calculation,
      });

      totalAmount += item.quantity * unitPrice;
      totalDiscountAmount += calculation.discountAmount;
      totalTaxAmount += calculation.taxAmount;
    }

    const finalAmount = totalAmount - totalDiscountAmount + totalTaxAmount;

    // Generate sale number
    const saleNumber = await this.generateSaleNumber(tenantId);

    // Create sale and items in transaction
    return await this.prisma.$transaction(async (tx) => {
      // Create sale
      const sale = await tx.sale.create({
        data: {
          sale_number: saleNumber,
          warehouse_id: createSaleDto.warehouse_id,
          user_id: userId,
          status: SaleStatus.COMPLETED,
          payment_method: createSaleDto.payment_method,
          total_amount: totalAmount,
          discount_amount: totalDiscountAmount,
          tax_amount: totalTaxAmount,
          final_amount: finalAmount,
          notes: createSaleDto.notes,
          tenant_id: tenantId,
        },
      });

      // Create sale items and update inventory
      const saleItems = [];
      for (const validated of validatedItems) {
        // Create sale item
        const saleItem = await tx.saleItem.create({
          data: {
            sale_id: sale.id,
            inventory_item_id: validated.inventoryItem.id,
            medicine_id: validated.inventoryItem.medicine_id,
            quantity: validated.item.quantity,
            unit_price: validated.unitPrice,
            discount_percent: validated.item.discount_percent ?? 0,
            discount_amount: validated.discountAmount,
            tax_percent: validated.item.tax_percent ?? 0,
            tax_amount: validated.taxAmount,
            subtotal: validated.subtotal,
            notes: validated.item.notes,
          },
        });

        saleItems.push(saleItem);

        // Update inventory quantity
        await tx.inventoryItem.update({
          where: { id: validated.inventoryItem.id },
          data: {
            quantity: {
              decrement: validated.item.quantity,
            },
          },
        });

        // Create stock movement
        await tx.stockMovement.create({
          data: {
            inventory_item_id: validated.inventoryItem.id,
            warehouse_id: createSaleDto.warehouse_id,
            movement_type: StockMovementType.OUT,
            quantity: validated.item.quantity,
            reference_type: 'SALE',
            reference_id: sale.id,
            notes: `Sale ${saleNumber}`,
            created_by: userId,
          },
        });
      }

      this.logger.log(
        `Sale created: ${saleNumber} with ${saleItems.length} items, total: ${finalAmount}`,
      );

      // Return sale with items
      return await this.findOne(sale.id, tenantId);
    });
  }

  /**
   * Find sale by ID
   */
  async findOne(
    id: string,
    tenantId: string,
  ): Promise<SaleResponseDto> {
    const sale = await this.prisma.sale.findFirst({
      where: {
        id,
        tenant_id: tenantId,
      },
      include: {
        sale_items: {
          include: {
            medicine: {
              select: {
                id: true,
                trade_name: true,
                strength: true,
                package_size: true,
              },
            },
            inventory_item: {
              select: {
                id: true,
                batch_number: true,
                expiry_date: true,
              },
            },
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true,
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
    });

    if (!sale) {
      throw new NotFoundException(`Sale with ID ${id} not found`);
    }

    // Convert Decimal to number for response
    return {
      ...sale,
      total_amount: Number(sale.total_amount),
      discount_amount: Number(sale.discount_amount),
      tax_amount: Number(sale.tax_amount),
      final_amount: Number(sale.final_amount),
      sale_items: sale.sale_items.map((item) => ({
        ...item,
        unit_price: Number(item.unit_price),
        discount_percent: item.discount_percent ? Number(item.discount_percent) : undefined,
        discount_amount: item.discount_amount ? Number(item.discount_amount) : undefined,
        tax_percent: item.tax_percent ? Number(item.tax_percent) : undefined,
        tax_amount: item.tax_amount ? Number(item.tax_amount) : undefined,
        subtotal: Number(item.subtotal),
      })),
    } as SaleResponseDto;
  }

  /**
   * List sales with filters
   */
  async findAll(
    tenantId: string,
    warehouseId?: string,
    status?: SaleStatus,
    paymentMethod?: PaymentMethod,
    startDate?: Date,
    endDate?: Date,
    paginationDto?: PaginationDto,
  ) {
    const page = paginationDto?.page || 1;
    const limit = paginationDto?.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {
      tenant_id: tenantId,
    };

    if (warehouseId) {
      where.warehouse_id = warehouseId;
    }

    if (status) {
      where.status = status;
    }

    if (paymentMethod) {
      where.payment_method = paymentMethod;
    }

    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) {
        where.created_at.gte = startDate;
      }
      if (endDate) {
        where.created_at.lte = endDate;
      }
    }

    const [sales, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        include: {
          warehouse: {
            select: {
              id: true,
              name: true,
              code: true,
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
          _count: {
            select: {
              sale_items: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.sale.count({ where }),
    ]);

    // Convert Decimal to number for response
    const salesWithNumbers = sales.map((sale) => ({
      ...sale,
      total_amount: Number(sale.total_amount),
      discount_amount: Number(sale.discount_amount),
      tax_amount: Number(sale.tax_amount),
      final_amount: Number(sale.final_amount),
    }));

    return {
      sales: salesWithNumbers,
      total,
      page,
      limit,
    };
  }

  /**
   * Cancel sale and restore stock
   */
  async cancelSale(
    id: string,
    tenantId: string,
    userId: string,
  ): Promise<SaleResponseDto> {
    const sale = await this.prisma.sale.findFirst({
      where: {
        id,
        tenant_id: tenantId,
      },
      include: {
        sale_items: {
          include: {
            inventory_item: true,
          },
        },
      },
    });

    if (!sale) {
      throw new NotFoundException(`Sale with ID ${id} not found`);
    }

    if (sale.status === SaleStatus.CANCELLED) {
      throw new BadRequestException('Sale is already cancelled');
    }

    if (sale.status === SaleStatus.REFUNDED) {
      throw new BadRequestException('Cannot cancel a refunded sale');
    }

    // Check if sale is recent (same day) - configurable
    const saleDate = new Date(sale.created_at);
    const today = new Date();
    const isSameDay =
      saleDate.getDate() === today.getDate() &&
      saleDate.getMonth() === today.getMonth() &&
      saleDate.getFullYear() === today.getFullYear();

    if (!isSameDay) {
      throw new ForbiddenException(
        'Can only cancel sales from the same day',
      );
    }

    // Restore stock in transaction
    return await this.prisma.$transaction(async (tx) => {
      // Update sale status
      const updatedSale = await tx.sale.update({
        where: { id },
        data: {
          status: SaleStatus.CANCELLED,
        },
      });

      // Restore inventory for each item
      for (const saleItem of sale.sale_items) {
        // Restore inventory quantity
        await tx.inventoryItem.update({
          where: { id: saleItem.inventory_item_id },
          data: {
            quantity: {
              increment: saleItem.quantity,
            },
          },
        });

        // Create stock movement (RETURN)
        await tx.stockMovement.create({
          data: {
            inventory_item_id: saleItem.inventory_item_id,
            warehouse_id: sale.warehouse_id,
            movement_type: StockMovementType.RETURN,
            quantity: saleItem.quantity,
            reference_type: 'SALE_CANCELLATION',
            reference_id: sale.id,
            notes: `Sale ${sale.sale_number} cancelled`,
            created_by: userId,
          },
        });
      }

      this.logger.log(`Sale cancelled: ${sale.sale_number}`);

      return await this.findOne(id, tenantId);
    });
  }

  /**
   * Get sales statistics
   */
  async getStatistics(
    tenantId: string,
    warehouseId?: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    const where: any = {
      tenant_id: tenantId,
      status: SaleStatus.COMPLETED,
    };

    if (warehouseId) {
      where.warehouse_id = warehouseId;
    }

    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) {
        where.created_at.gte = startDate;
      }
      if (endDate) {
        where.created_at.lte = endDate;
      }
    }

    const [totalSales, totalAmount, sales] = await Promise.all([
      this.prisma.sale.count({ where }),
      this.prisma.sale.aggregate({
        where,
        _sum: {
          final_amount: true,
        },
      }),
      this.prisma.sale.findMany({
        where,
        select: {
          final_amount: true,
          payment_method: true,
        },
      }),
    ]);

    const totalRevenue = Number(totalAmount._sum.final_amount || 0);
    const averageTransaction =
      totalSales > 0 ? totalRevenue / totalSales : 0;

    // Sales by payment method
    const salesByPaymentMethod = sales.reduce((acc, sale) => {
      const method = sale.payment_method;
      acc[method] = (acc[method] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total_sales: totalSales,
      total_revenue: totalRevenue,
      average_transaction: Math.round(averageTransaction * 100) / 100,
      sales_by_payment_method: salesByPaymentMethod,
    };
  }
}

