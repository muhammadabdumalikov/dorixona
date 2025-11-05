import { Module } from '@nestjs/common';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { ReceiptService } from './services/receipt.service';
import { PrismaService } from '../config/prisma.service';

@Module({
  controllers: [SalesController],
  providers: [SalesService, ReceiptService, PrismaService],
  exports: [SalesService],
})
export class SalesModule {}

