import { IsNumber, Min, IsOptional, IsString, IsBoolean, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePriceDto {
  @ApiProperty({
    description: 'New price in Uzbek Som',
    example: 15000.50
  })
  @IsNumber()
  @Min(0)
  price: number;
}

export class BulkUpdatePricesDto {
  @ApiProperty({
    description: 'Array of price updates',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        medicineId: { type: 'string', description: 'Medicine ID' },
        price: { type: 'number', description: 'New price' }
      }
    }
  })
  updates: Array<{
    medicineId: string;
    price: number;
  }>;
}

export class UpdateMedicineDto {
  @ApiPropertyOptional({ description: 'Trade name' })
  @IsOptional()
  @IsString()
  trade_name?: string;

  @ApiPropertyOptional({ description: 'Registration number' })
  @IsOptional()
  @IsString()
  registration_number?: string;

  @ApiPropertyOptional({ description: 'Strength (e.g., "500mg")' })
  @IsOptional()
  @IsString()
  strength?: string;

  @ApiPropertyOptional({ description: 'Package size' })
  @IsOptional()
  @IsString()
  package_size?: string;

  @ApiPropertyOptional({ description: 'Whether prescription is required' })
  @IsOptional()
  @IsBoolean()
  prescription_required?: boolean;

  @ApiPropertyOptional({ description: 'Whether this is a generic medicine' })
  @IsOptional()
  @IsBoolean()
  is_generic?: boolean;

  @ApiPropertyOptional({ description: 'Whether the medicine is available' })
  @IsOptional()
  @IsBoolean()
  is_available?: boolean;

  @ApiPropertyOptional({ description: 'Barcode' })
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiPropertyOptional({ description: 'Registration date' })
  @IsOptional()
  @IsDateString()
  registration_date?: string;

  @ApiPropertyOptional({ description: 'Expiry date' })
  @IsOptional()
  @IsDateString()
  expiry_date?: string;
}
