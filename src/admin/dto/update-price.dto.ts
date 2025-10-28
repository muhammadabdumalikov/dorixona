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
  tradeName?: string;

  @ApiPropertyOptional({ description: 'Registration number' })
  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @ApiPropertyOptional({ description: 'Strength (e.g., "500mg")' })
  @IsOptional()
  @IsString()
  strength?: string;

  @ApiPropertyOptional({ description: 'Package size' })
  @IsOptional()
  @IsString()
  packageSize?: string;

  @ApiPropertyOptional({ description: 'Whether prescription is required' })
  @IsOptional()
  @IsBoolean()
  prescriptionRequired?: boolean;

  @ApiPropertyOptional({ description: 'Whether this is a generic medicine' })
  @IsOptional()
  @IsBoolean()
  isGeneric?: boolean;

  @ApiPropertyOptional({ description: 'Whether the medicine is available' })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @ApiPropertyOptional({ description: 'Barcode' })
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiPropertyOptional({ description: 'Registration date' })
  @IsOptional()
  @IsDateString()
  registrationDate?: string;

  @ApiPropertyOptional({ description: 'Expiry date' })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}
