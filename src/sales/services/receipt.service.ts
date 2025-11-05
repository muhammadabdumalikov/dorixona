import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { ReceiptDto, ReceiptItemDto } from '../dto/receipt.dto';

@Injectable()
export class ReceiptService {
  constructor(private prisma: PrismaService) {}

  async generateReceipt(saleId: string, tenantId: string): Promise<ReceiptDto> {
    const sale = await this.prisma.sale.findFirst({
      where: {
        id: saleId,
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
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            address: true,
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
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!sale) {
      throw new Error('Sale not found');
    }

    const items: ReceiptItemDto[] = sale.sale_items.map((item) => ({
      medicine_name: `${item.medicine.trade_name}${item.medicine.strength ? ` (${item.medicine.strength})` : ''}`,
      quantity: item.quantity,
      unit_price: Number(item.unit_price),
      subtotal: Number(item.subtotal),
      discount_amount: item.discount_amount ? Number(item.discount_amount) : undefined,
      tax_amount: item.tax_amount ? Number(item.tax_amount) : undefined,
    }));

    const cashierName = sale.user.first_name && sale.user.last_name
      ? `${sale.user.first_name} ${sale.user.last_name}`
      : sale.user.email;

    return {
      sale_number: sale.sale_number,
      sale_date: sale.created_at,
      tenant_name: sale.tenant.name,
      warehouse_name: sale.warehouse?.name,
      warehouse_address: sale.warehouse?.address || undefined,
      cashier_name: cashierName,
      items,
      total_amount: Number(sale.total_amount),
      discount_amount: Number(sale.discount_amount),
      tax_amount: Number(sale.tax_amount),
      final_amount: Number(sale.final_amount),
      payment_method: sale.payment_method,
      notes: sale.notes || undefined,
    };
  }
}

