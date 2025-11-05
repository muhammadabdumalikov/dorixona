import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateSaleItemDto {
  @ApiProperty({
    description: 'Inventory item ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  inventory_item_id: string;

  @ApiProperty({
    description: 'Quantity to sell',
    example: 2,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({
    description: 'Unit price (overrides inventory item selling price)',
    example: 15000.00,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unit_price?: number;

  @ApiPropertyOptional({
    description: 'Discount percentage',
    example: 10.0,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount_percent?: number;

  @ApiPropertyOptional({
    description: 'Discount amount (fixed)',
    example: 500.00,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount_amount?: number;

  @ApiPropertyOptional({
    description: 'Tax percentage',
    example: 12.0,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tax_percent?: number;

  @ApiPropertyOptional({
    description: 'Additional notes for this item',
    example: 'Customer requested specific batch',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class SaleItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  sale_id: string;

  @ApiProperty()
  inventory_item_id: string;

  @ApiProperty()
  medicine_id: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  unit_price: number;

  @ApiProperty({ nullable: true })
  discount_percent?: number;

  @ApiProperty({ nullable: true })
  discount_amount?: number;

  @ApiProperty({ nullable: true })
  tax_percent?: number;

  @ApiProperty({ nullable: true })
  tax_amount?: number;

  @ApiProperty()
  subtotal: number;

  @ApiProperty({ nullable: true })
  notes?: string;

  @ApiProperty()
  created_at: Date;

  @ApiPropertyOptional()
  medicine?: {
    id: string;
    trade_name: string;
    strength?: string;
    package_size?: string;
  };

  @ApiPropertyOptional()
  inventory_item?: {
    id: string;
    batch_number?: string;
    expiry_date?: Date;
  };
}

