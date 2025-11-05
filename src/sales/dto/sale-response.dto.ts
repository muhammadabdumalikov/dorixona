import { ApiProperty } from '@nestjs/swagger';
import { SaleStatus, PaymentMethod } from '@prisma/client';
import { SaleItemResponseDto } from './sale-item.dto';

export class SaleResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  sale_number: string;

  @ApiProperty()
  warehouse_id: string;

  @ApiProperty()
  user_id: string;

  @ApiProperty()
  status: SaleStatus;

  @ApiProperty()
  payment_method: PaymentMethod;

  @ApiProperty()
  total_amount: number;

  @ApiProperty()
  discount_amount: number;

  @ApiProperty()
  tax_amount: number;

  @ApiProperty()
  final_amount: number;

  @ApiProperty({ nullable: true })
  notes?: string;

  @ApiProperty()
  tenant_id: string;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;

  @ApiPropertyOptional()
  warehouse?: {
    id: string;
    name: string;
    code?: string;
  };

  @ApiPropertyOptional()
  user?: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
  };

  @ApiPropertyOptional({ type: [SaleItemResponseDto] })
  items?: SaleItemResponseDto[];
}

