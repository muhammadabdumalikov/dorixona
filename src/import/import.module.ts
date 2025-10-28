import { Module } from '@nestjs/common';
import { ImportService } from './import.service';
import { ImportController } from './import.controller';
import { PrismaService } from '../config/prisma.service';

@Module({
  providers: [ImportService, PrismaService],
  controllers: [ImportController],
  exports: [ImportService],
})
export class ImportModule {}
