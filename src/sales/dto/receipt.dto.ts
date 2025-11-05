import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';

export class ReceiptItemDto {
  @ApiProperty()
  medicine_name: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  unit_price: number;

  @ApiProperty()
  subtotal: number;

  @ApiProperty({ nullable: true })
  discount_amount?: number;

  @ApiProperty({ nullable: true })
  tax_amount?: number;
}

export class ReceiptDto {
  @ApiProperty()
  sale_number: string;

  @ApiProperty()
  sale_date: Date;

  @ApiProperty()
  tenant_name: string;

  @ApiProperty({ nullable: true })
  warehouse_name?: string;

  @ApiProperty({ nullable: true })
  warehouse_address?: string;

  @ApiProperty()
  cashier_name: string;

  @ApiProperty({ type: [ReceiptItemDto] })
  items: ReceiptItemDto[];

  @ApiProperty()
  total_amount: number;

  @ApiProperty()
  discount_amount: number;

  @ApiProperty()
  tax_amount: number;

  @ApiProperty()
  final_amount: number;

  @ApiProperty()
  payment_method: PaymentMethod;

  @ApiProperty({ nullable: true })
  notes?: string;
}

