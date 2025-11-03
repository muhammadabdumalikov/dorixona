import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MedicineDetailDto {
  @ApiProperty({ description: 'Medicine ID' })
  id: string;

  @ApiProperty({ description: 'Trade name of the medicine' })
  trade_name: string;

  @ApiPropertyOptional({ description: 'Registration number' })
  registration_number?: string;

  @ApiPropertyOptional({ description: 'Medicine strength (e.g., "500mg")' })
  strength?: string;

  @ApiPropertyOptional({ description: 'Numeric strength value' })
  strength_numeric?: number;

  @ApiPropertyOptional({ description: 'Strength unit (e.g., "mg", "g")' })
  strength_unit?: string;

  @ApiPropertyOptional({ description: 'Package size (e.g., "10 tablets")' })
  package_size?: string;

  @ApiPropertyOptional({ description: 'Package quantity' })
  package_quantity?: number;

  @ApiPropertyOptional({ description: 'Price in Uzbek Som' })
  price_uzs?: number;

  @ApiPropertyOptional({ description: 'Last price update timestamp' })
  price_last_updated?: Date;

  @ApiProperty({ description: 'Whether prescription is required' })
  prescription_required: boolean;

  @ApiProperty({ description: 'Whether this is a generic medicine' })
  is_generic: boolean;

  @ApiProperty({ description: 'Whether the medicine is available' })
  is_available: boolean;

  @ApiPropertyOptional({ description: 'Barcode' })
  barcode?: string;

  @ApiPropertyOptional({ description: 'Registration date' })
  registration_date?: Date;

  @ApiPropertyOptional({ description: 'Expiry date' })
  expiry_date?: Date;

  @ApiProperty({ description: 'Creation timestamp' })
  created_at: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updated_at: Date;

  @ApiProperty({ description: 'Dosage form information' })
  dosage_form: {
    id: string;
    name: string;
    name_uzbek?: string;
    description?: string;
  };

  @ApiProperty({ description: 'Manufacturer information' })
  manufacturer: {
    id: string;
    name: string;
    country?: string;
    is_local: boolean;
    reliability_rating?: number;
  };

  @ApiProperty({ description: 'Active ingredients with quantities', type: 'array' })
  active_ingredients: Array<{
    id: string;
    name: string;
    name_latin?: string;
    name_uzbek?: string;
    atc_code?: string;
    therapeutic_class?: string;
    description?: string;
    warnings?: string;
    is_narrow_therapeutic_index: boolean;
    quantity?: number;
    quantity_unit?: string;
    is_primary: boolean;
  }>;
}
