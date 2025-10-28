import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MedicineDetailDto {
  @ApiProperty({ description: 'Medicine ID' })
  id: string;

  @ApiProperty({ description: 'Trade name of the medicine' })
  tradeName: string;

  @ApiPropertyOptional({ description: 'Registration number' })
  registrationNumber?: string;

  @ApiPropertyOptional({ description: 'Medicine strength (e.g., "500mg")' })
  strength?: string;

  @ApiPropertyOptional({ description: 'Numeric strength value' })
  strengthNumeric?: number;

  @ApiPropertyOptional({ description: 'Strength unit (e.g., "mg", "g")' })
  strengthUnit?: string;

  @ApiPropertyOptional({ description: 'Package size (e.g., "10 tablets")' })
  packageSize?: string;

  @ApiPropertyOptional({ description: 'Package quantity' })
  packageQuantity?: number;

  @ApiPropertyOptional({ description: 'Price in Uzbek Som' })
  priceUzs?: number;

  @ApiPropertyOptional({ description: 'Last price update timestamp' })
  priceLastUpdated?: Date;

  @ApiProperty({ description: 'Whether prescription is required' })
  prescriptionRequired: boolean;

  @ApiProperty({ description: 'Whether this is a generic medicine' })
  isGeneric: boolean;

  @ApiProperty({ description: 'Whether the medicine is available' })
  isAvailable: boolean;

  @ApiPropertyOptional({ description: 'Barcode' })
  barcode?: string;

  @ApiPropertyOptional({ description: 'Registration date' })
  registrationDate?: Date;

  @ApiPropertyOptional({ description: 'Expiry date' })
  expiryDate?: Date;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;

  @ApiProperty({ description: 'Dosage form information' })
  dosageForm: {
    id: string;
    name: string;
    nameUzbek?: string;
    description?: string;
  };

  @ApiProperty({ description: 'Manufacturer information' })
  manufacturer: {
    id: string;
    name: string;
    country?: string;
    isLocal: boolean;
    reliabilityRating?: number;
  };

  @ApiProperty({ description: 'Active ingredients with quantities', type: 'array' })
  activeIngredients: Array<{
    id: string;
    name: string;
    nameLatin?: string;
    nameUzbek?: string;
    atcCode?: string;
    therapeuticClass?: string;
    description?: string;
    warnings?: string;
    isNarrowTherapeuticIndex: boolean;
    quantity?: number;
    quantityUnit?: string;
    isPrimary: boolean;
  }>;
}
