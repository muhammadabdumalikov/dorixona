import { Module } from '@nestjs/common';
import { ManufacturersService } from './manufacturers.service';
import { ManufacturersController } from './manufacturers.controller';
import { PrismaService } from '../config/prisma.service';

@Module({
  providers: [ManufacturersService, PrismaService],
  controllers: [ManufacturersController],
  exports: [ManufacturersService],
})
export class ManufacturersModule { }
