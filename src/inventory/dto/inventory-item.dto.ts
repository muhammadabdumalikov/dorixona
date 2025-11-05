import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsInt, IsDecimal, IsDateString, Min } from 'class-validator';

export class InventoryItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  medicine_id: string;

  @ApiProperty()
  warehouse_id: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  reserved_qty: number;

  @ApiProperty({ nullable: true })
  reorder_point?: number;

  @ApiProperty({ nullable: true })
  max_stock?: number;

  @ApiProperty({ nullable: true })
  cost_price?: number;

  @ApiProperty({ nullable: true })
  selling_price?: number;

  @ApiProperty({ nullable: true })
  batch_number?: string;

  @ApiProperty({ nullable: true })
  expiry_date?: Date;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;

  @ApiPropertyOptional()
  medicine?: {
    id: string;
    trade_name: string;
    strength?: string;
    package_size?: string;
  };

  @ApiPropertyOptional()
  warehouse?: {
    id: string;
    name: string;
    code?: string;
  };
}

