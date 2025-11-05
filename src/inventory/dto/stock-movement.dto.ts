import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsEnum,
  IsInt,
  IsString,
  IsOptional,
  Min,
} from 'class-validator';
import { StockMovementType } from '@prisma/client';

export class CreateStockMovementDto {
  @ApiProperty({
    description: 'Inventory item ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  inventory_item_id: string;

  @ApiProperty({
    description: 'Warehouse ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  warehouse_id: string;

  @ApiProperty({
    description: 'Type of stock movement',
    enum: StockMovementType,
    example: StockMovementType.IN,
  })
  @IsEnum(StockMovementType)
  movement_type: StockMovementType;

  @ApiProperty({
    description: 'Quantity moved (positive for IN, negative for OUT)',
    example: 10,
  })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({
    description: 'Reference type (e.g., PURCHASE, SALE, ADJUSTMENT)',
    example: 'PURCHASE',
  })
  @IsOptional()
  @IsString()
  reference_type?: string;

  @ApiPropertyOptional({
    description: 'Reference document ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  reference_id?: string;

  @ApiPropertyOptional({
    description: 'Additional notes',
    example: 'Stock received from supplier',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class StockMovementResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  inventory_item_id: string;

  @ApiProperty()
  warehouse_id: string;

  @ApiProperty()
  movement_type: StockMovementType;

  @ApiProperty()
  quantity: number;

  @ApiProperty({ nullable: true })
  reference_type?: string;

  @ApiProperty({ nullable: true })
  reference_id?: string;

  @ApiProperty({ nullable: true })
  notes?: string;

  @ApiProperty({ nullable: true })
  created_by?: string;

  @ApiProperty()
  created_at: Date;
}

