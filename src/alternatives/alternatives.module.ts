import { Module } from '@nestjs/common';
import { AlternativesService } from './alternatives.service';
import { AlternativesController } from './alternatives.controller';
import { PrismaService } from '../config/prisma.service';

@Module({
  providers: [AlternativesService, PrismaService],
  controllers: [AlternativesController],
  exports: [AlternativesService],
})
export class AlternativesModule { }
