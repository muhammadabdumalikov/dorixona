import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { UpdatePriceDto, BulkUpdatePricesDto, UpdateMedicineDto } from './dto/update-price.dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private prisma: PrismaService) { }

  async updateMedicinePrice(medicineId: string, updatePriceDto: UpdatePriceDto): Promise<void> {
    this.logger.log(`Updating price for medicine ${medicineId} to ${updatePriceDto.price}`);

    try {
      const medicine = await this.prisma.medicine.findUnique({
        where: { id: medicineId },
      });

      if (!medicine) {
        throw new NotFoundException(`Medicine with ID ${medicineId} not found`);
      }

      await this.prisma.medicine.update({
        where: { id: medicineId },
        data: {
          price_uzs: updatePriceDto.price,
          price_last_updated: new Date(),
        },
      });

      this.logger.log(`Successfully updated price for medicine ${medicineId}`);
    } catch (error) {
      this.logger.error(`Failed to update price for medicine ${medicineId}: ${error.message}`);
      throw error;
    }
  }

  async bulkUpdatePrices(bulkUpdatePricesDto: BulkUpdatePricesDto): Promise<{
    updated: number;
    failed: number;
    errors: string[];
  }> {
    this.logger.log(`Bulk updating prices for ${bulkUpdatePricesDto.updates.length} medicines`);

    const result = {
      updated: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const update of bulkUpdatePricesDto.updates) {
      try {
        await this.updateMedicinePrice(update.medicineId, { price: update.price });
        result.updated++;
      } catch (error) {
        result.failed++;
        result.errors.push(`Medicine ${update.medicineId}: ${error.message}`);
      }
    }

    this.logger.log(`Bulk update completed: ${result.updated} updated, ${result.failed} failed`);
    return result;
  }

  async updateMedicine(medicineId: string, updateMedicineDto: UpdateMedicineDto): Promise<void> {
    this.logger.log(`Updating medicine ${medicineId}`);

    try {
      const medicine = await this.prisma.medicine.findUnique({
        where: { id: medicineId },
      });

      if (!medicine) {
        throw new NotFoundException(`Medicine with ID ${medicineId} not found`);
      }

      await this.prisma.medicine.update({
        where: { id: medicineId },
        data: {
          ...updateMedicineDto,
          updated_at: new Date(),
        },
      });

      this.logger.log(`Successfully updated medicine ${medicineId}`);
    } catch (error) {
      this.logger.error(`Failed to update medicine ${medicineId}: ${error.message}`);
      throw error;
    }
  }

  async toggleAvailability(medicineId: string): Promise<void> {
    this.logger.log(`Toggling availability for medicine ${medicineId}`);

    try {
      const medicine = await this.prisma.medicine.findUnique({
        where: { id: medicineId },
      });

      if (!medicine) {
        throw new NotFoundException(`Medicine with ID ${medicineId} not found`);
      }

      await this.prisma.medicine.update({
        where: { id: medicineId },
        data: {
          is_available: !medicine.is_available,
          updated_at: new Date(),
        },
      });

      this.logger.log(`Successfully toggled availability for medicine ${medicineId}`);
    } catch (error) {
      this.logger.error(`Failed to toggle availability for medicine ${medicineId}: ${error.message}`);
      throw error;
    }
  }

  async softDeleteMedicine(medicineId: string): Promise<void> {
    this.logger.log(`Soft deleting medicine ${medicineId}`);

    try {
      const medicine = await this.prisma.medicine.findUnique({
        where: { id: medicineId },
      });

      if (!medicine) {
        throw new NotFoundException(`Medicine with ID ${medicineId} not found`);
      }

      await this.prisma.medicine.update({
        where: { id: medicineId },
        data: {
          is_available: false,
          updated_at: new Date(),
        },
      });

      this.logger.log(`Successfully soft deleted medicine ${medicineId}`);
    } catch (error) {
      this.logger.error(`Failed to soft delete medicine ${medicineId}: ${error.message}`);
      throw error;
    }
  }

  async getImportStatistics(): Promise<{
    totalMedicines: number;
    totalActiveIngredients: number;
    totalManufacturers: number;
    totalDosageForms: number;
    medicinesWithPrices: number;
    lastImportDate?: Date;
  }> {
    try {
      const [
        totalMedicines,
        totalActiveIngredients,
        totalManufacturers,
        totalDosageForms,
        medicinesWithPrices,
        lastImportDate,
      ] = await Promise.all([
        this.prisma.medicine.count(),
        this.prisma.activeIngredient.count(),
        this.prisma.manufacturer.count(),
        this.prisma.dosageForm.count(),
        this.prisma.medicine.count({
            where: { price_uzs: { not: null } },
        }),
        this.prisma.medicine.findFirst({
          orderBy: { created_at: 'desc' },
          select: { created_at: true },
        }),
      ]);

      return {
        totalMedicines,
        totalActiveIngredients,
        totalManufacturers,
        totalDosageForms,
        medicinesWithPrices,
        lastImportDate: lastImportDate?.created_at,
      };
    } catch (error) {
      this.logger.error(`Failed to get import statistics: ${error.message}`);
      throw error;
    }
  }

  async getDatabaseStatus(): Promise<{
    connected: boolean;
    tables: string[];
    error?: string;
  }> {
    try {
      // Test database connection
      await this.prisma.$queryRaw`SELECT 1`;

      // Get list of tables
      const tables = await this.prisma.$queryRaw<Array<{ tablename: string }>>`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      `;

      return {
        connected: true,
        tables: tables.map(t => t.tablename),
      };
    } catch (error) {
      return {
        connected: false,
        tables: [],
        error: error.message,
      };
    }
  }
}
