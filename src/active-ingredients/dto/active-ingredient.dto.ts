import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ActiveIngredientDto {
  @ApiProperty({ description: 'Active ingredient ID' })
  id: string;

  @ApiProperty({ description: 'Active ingredient name' })
  name: string;

  @ApiPropertyOptional({ description: 'Latin name' })
  nameLatin?: string;

  @ApiPropertyOptional({ description: 'Uzbek name' })
  nameUzbek?: string;

  @ApiPropertyOptional({ description: 'ATC code' })
  atcCode?: string;

  @ApiPropertyOptional({ description: 'Therapeutic class' })
  therapeuticClass?: string;

  @ApiPropertyOptional({ description: 'Description' })
  description?: string;

  @ApiPropertyOptional({ description: 'Warnings' })
  warnings?: string;

  @ApiProperty({ description: 'Whether this is a narrow therapeutic index ingredient' })
  isNarrowTherapeuticIndex: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;

  @ApiProperty({ description: 'Number of medicines containing this ingredient' })
  medicineCount: number;
}
