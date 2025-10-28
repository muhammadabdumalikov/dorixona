import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MedicineResponseDto {
  @ApiProperty({ description: 'Medicine ID' })
  id: string;

  @ApiProperty({ description: 'Trade name of the medicine' })
  tradeName: string;

  @ApiPropertyOptional({ description: 'Registration number' })
  registrationNumber?: string;

  @ApiPropertyOptional({ description: 'Medicine strength (e.g., "500mg")' })
  strength?: string;

  @ApiPropertyOptional({ description: 'Package size (e.g., "10 tablets")' })
  packageSize?: string;

  @ApiPropertyOptional({ description: 'Price in Uzbek Som' })
  priceUzs?: number;

  @ApiProperty({ description: 'Whether this is a generic medicine' })
  isGeneric: boolean;

  @ApiProperty({ description: 'Whether the medicine is available' })
  isAvailable: boolean;

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
}
