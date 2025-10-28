import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ManufacturerDto {
  @ApiProperty({ description: 'Manufacturer ID' })
  id: string;

  @ApiProperty({ description: 'Manufacturer name' })
  name: string;

  @ApiPropertyOptional({ description: 'Country' })
  country?: string;

  @ApiProperty({ description: 'Whether this is a local (Uzbek) manufacturer' })
  isLocal: boolean;

  @ApiPropertyOptional({ description: 'Reliability rating (1-5)' })
  reliabilityRating?: number;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;

  @ApiProperty({ description: 'Number of medicines from this manufacturer' })
  medicineCount: number;
}
