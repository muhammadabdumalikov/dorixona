import { Module } from '@nestjs/common';
import { ImportService } from './import.service';
import { ImportController } from './import.controller';
import { ImportSchedulerService } from './import-scheduler.service';
import { PrismaService } from '../config/prisma.service';

@Module({
  providers: [ImportService, ImportSchedulerService, PrismaService],
  controllers: [ImportController],
  exports: [ImportService],
})
export class ImportModule {}
