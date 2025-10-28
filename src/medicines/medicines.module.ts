import { Module } from '@nestjs/common';
import { MedicinesService } from './medicines.service';
import { MedicinesController } from './medicines.controller';
import { PrismaService } from '../config/prisma.service';

@Module({
  providers: [MedicinesService, PrismaService],
  controllers: [MedicinesController],
  exports: [MedicinesService],
})
export class MedicinesModule { }
