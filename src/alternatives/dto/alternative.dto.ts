import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AlternativeDto {
  @ApiProperty({ description: 'Alternative medicine ID' })
  id: string;

  @ApiProperty({ description: 'Trade name of the alternative medicine' })
  tradeName: string;

  @ApiPropertyOptional({ description: 'Medicine strength (e.g., "500mg")' })
  strength?: string;

  @ApiPropertyOptional({ description: 'Package size (e.g., "10 tablets")' })
  packageSize?: string;

  @ApiPropertyOptional({ description: 'Price in Uzbek Som' })
  priceUzs?: number;

  @ApiProperty({ description: 'Whether this is a generic medicine' })
  isGeneric: boolean;

  @ApiProperty({ description: 'Whether prescription is required' })
  prescriptionRequired: boolean;

  @ApiPropertyOptional({ description: 'Dosage form (e.g., "Tablet", "Capsule")' })
  dosageForm?: string;

  @ApiPropertyOptional({ description: 'Manufacturer name' })
  manufacturer?: string;

  @ApiPropertyOptional({ description: 'Manufacturer country' })
  manufacturerCountry?: string;

  @ApiProperty({ description: 'List of active ingredients', type: [String] })
  activeIngredients: string[];

  @ApiPropertyOptional({ description: 'Savings amount compared to original medicine' })
  savings?: number;

  @ApiPropertyOptional({ description: 'Savings percentage compared to original medicine' })
  savingsPercentage?: number;

  @ApiProperty({ description: 'Whether this is an exact match (same active ingredients)' })
  exactMatch: boolean;

  @ApiProperty({ description: 'Whether this has the same dosage form' })
  sameDosageForm: boolean;

  @ApiProperty({ description: 'Whether this has the same strength' })
  sameStrength: boolean;

  @ApiProperty({ description: 'Whether this contains narrow therapeutic index ingredients' })
  hasNarrowTherapeuticIndex: boolean;

  @ApiProperty({ description: 'Medical disclaimer' })
  disclaimer: string;

  @ApiPropertyOptional({ description: 'Special warnings' })
  warnings?: string;
}
