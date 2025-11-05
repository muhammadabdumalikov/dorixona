import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class AdjustStockDto {
  @ApiProperty({
    description: 'New quantity (positive integer)',
    example: 50,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  quantity: number;

  @ApiProperty({
    description: 'Reason for adjustment',
    example: 'Physical count correction',
    required: false,
  })
  notes?: string;
}

