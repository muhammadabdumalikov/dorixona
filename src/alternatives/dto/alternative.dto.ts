import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AlternativeDto {
  @ApiProperty({ description: 'Alternative medicine ID' })
  id: string;

  @ApiProperty({ description: 'Trade name of the alternative medicine' })
  trade_name: string;

  @ApiPropertyOptional({ description: 'Medicine strength (e.g., "500mg")' })
  strength?: string;

  @ApiPropertyOptional({ description: 'Package size (e.g., "10 tablets")' })
  package_size?: string;

  @ApiPropertyOptional({ description: 'Price in Uzbek Som' })
  price_uzs?: number;

  @ApiProperty({ description: 'Whether this is a generic medicine' })
  is_generic: boolean;

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

  @ApiPropertyOptional({ description: 'Savings amount compared to original medicine' })
  savings?: number;

  @ApiPropertyOptional({ description: 'Savings percentage compared to original medicine' })
  savings_percentage?: number;

  @ApiProperty({ description: 'Whether this is an exact match (same active ingredients)' })
  exact_match: boolean;

  @ApiProperty({ description: 'Whether this has the same dosage form' })
  same_dosage_form: boolean;

  @ApiProperty({ description: 'Whether this has the same strength' })
  same_strength: boolean;

  @ApiProperty({ description: 'Whether this contains narrow therapeutic index ingredients' })
  has_narrow_therapeutic_index: boolean;

  @ApiProperty({ description: 'Medical disclaimer' })
  disclaimer: string;

  @ApiPropertyOptional({ description: 'Special warnings' })
  warnings?: string;
}
