import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MedicineResponseDto {
  @ApiProperty({ description: 'Medicine ID' })
  id: string;

  @ApiProperty({ description: 'Trade name of the medicine' })
  trade_name: string;

  @ApiPropertyOptional({ description: 'Registration number' })
  registration_number?: string;

  @ApiPropertyOptional({ description: 'Medicine strength (e.g., "500mg")' })
  strength?: string;

  @ApiPropertyOptional({ description: 'Package size (e.g., "10 tablets")' })
  package_size?: string;

  @ApiPropertyOptional({ description: 'Price in Uzbek Som' })
  price_uzs?: number;

  @ApiProperty({ description: 'Whether this is a generic medicine' })
  is_generic: boolean;

  @ApiProperty({ description: 'Whether the medicine is available' })
  is_available: boolean;

  @ApiProperty({ description: 'Whether prescription is required' })
  prescription_required: boolean;

  @ApiPropertyOptional({ description: 'Dosage form (e.g., "Tablet", "Capsule")' })
  dosage_form?: string;

  @ApiPropertyOptional({ description: 'Manufacturer name' })
  manufacturer?: string;

  @ApiPropertyOptional({ description: 'Manufacturer country' })
  manufacturer_country?: string;

  @ApiProperty({ description: 'List of active ingredients', type: [String] })
  active_ingredients: string[];
}
