import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './config/prisma.service';
import { DatabaseConfigService } from './config/database.config';
import { ImportModule } from './import/import.module';
import { SearchModule } from './search/search.module';
import { AlternativesModule } from './alternatives/alternatives.module';
import { MedicinesModule } from './medicines/medicines.module';
import { ActiveIngredientsModule } from './active-ingredients/active-ingredients.module';
import { ManufacturersModule } from './manufacturers/manufacturers.module';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { InventoryModule } from './inventory/inventory.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    InventoryModule,
    ImportModule,
    SearchModule,
    AlternativesModule,
    MedicinesModule,
    ActiveIngredientsModule,
    ManufacturersModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService, DatabaseConfigService],
  exports: [PrismaService, DatabaseConfigService],
})
export class AppModule { }
