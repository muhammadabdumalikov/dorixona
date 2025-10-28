import { Module } from '@nestjs/common';
import { ActiveIngredientsService } from './active-ingredients.service';
import { ActiveIngredientsController } from './active-ingredients.controller';
import { PrismaService } from '../config/prisma.service';

@Module({
  providers: [ActiveIngredientsService, PrismaService],
  controllers: [ActiveIngredientsController],
  exports: [ActiveIngredientsService],
})
export class ActiveIngredientsModule { }
