import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsEnum,
  IsArray,
  ValidateNested,
  IsOptional,
  IsString,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';
import { CreateSaleItemDto } from './sale-item.dto';

export class CreateSaleDto {
  @ApiProperty({
    description: 'Warehouse ID where sale is made',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  warehouse_id: string;

  @ApiProperty({
    description: 'Payment method',
    enum: PaymentMethod,
    example: PaymentMethod.CASH,
  })
  @IsEnum(PaymentMethod)
  payment_method: PaymentMethod;

  @ApiProperty({
    description: 'Sale items',
    type: [CreateSaleItemDto],
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items: CreateSaleItemDto[];

  @ApiPropertyOptional({
    description: 'Additional notes for the sale',
    example: 'Customer requested receipt',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

