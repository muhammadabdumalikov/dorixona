import { ApiProperty } from '@nestjs/swagger';

export class WarehouseResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true })
  code?: string;

  @ApiProperty({ nullable: true })
  address?: string;

  @ApiProperty()
  is_active: boolean;

  @ApiProperty()
  tenant_id: string;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;
}

