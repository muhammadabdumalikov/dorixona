import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { PaginationDto } from '../common/dtos/pagination.dto';
import { MedicineResponseDto } from './dto/medicine-response.dto';
import { MedicineDetailDto } from './dto/medicine-detail.dto';

@Injectable()
export class MedicinesService {
  private readonly logger = new Logger(MedicinesService.name);

  constructor(private prisma: PrismaService) { }

  async findAll(paginationDto: PaginationDto): Promise<{
    medicines: MedicineResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    try {
      const [medicines, total] = await Promise.all([
        this.prisma.$queryRaw<MedicineResponseDto[]>`
          SELECT 
            m.id,
            m."tradeName",
            m."registrationNumber",
            m.strength,
            m."packageSize",
            m."priceUzs",
            m."isGeneric",
            m."isAvailable",
            m."prescriptionRequired",
            df.name as "dosageForm",
            mf.name as "manufacturer",
            mf.country as "manufacturerCountry",
            array_agg(DISTINCT ai.name) as "activeIngredients"
          FROM medicines m
          LEFT JOIN dosage_forms df ON m."dosageFormId" = df.id
          LEFT JOIN manufacturers mf ON m."manufacturerId" = mf.id
          LEFT JOIN medicine_active_ingredients mai ON m.id = mai."medicineId"
          LEFT JOIN active_ingredients ai ON mai."activeIngredientId" = ai.id
          WHERE m."isAvailable" = true
          GROUP BY m.id, df.name, mf.name, mf.country
          ORDER BY m."tradeName" ASC
          LIMIT ${limit} OFFSET ${skip}
        `,
        this.prisma.medicine.count({
          where: { isAvailable: true },
        }),
      ]);

      return {
        medicines,
        total,
        page,
        limit,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch medicines: ${error.message}`);
      throw error;
    }
  }

  async findOne(id: string): Promise<MedicineDetailDto> {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      throw new NotFoundException(`Invalid medicine ID format: ${id}`);
    }

    try {
      const medicine = await this.prisma.medicine.findUnique({
        where: { id },
        include: {
          manufacturers: true,
          dosage_forms: true,
          medicine_active_ingredients: {
            include: {
              active_ingredients: true,
            },
          },
        },
      });

      if (!medicine) {
        throw new NotFoundException(`Medicine with ID ${id} not found`);
      }

      return {
        id: medicine.id,
        tradeName: medicine.tradeName,
        registrationNumber: medicine.registrationNumber,
        strength: medicine.strength,
        strengthNumeric: medicine.strengthNumeric ? Number(medicine.strengthNumeric) : undefined,
        strengthUnit: medicine.strengthUnit,
        packageSize: medicine.packageSize,
        packageQuantity: medicine.packageQuantity,
        priceUzs: medicine.priceUzs ? Number(medicine.priceUzs) : undefined,
        priceLastUpdated: medicine.priceLastUpdated,
        prescriptionRequired: medicine.prescriptionRequired,
        isGeneric: medicine.isGeneric,
        isAvailable: medicine.isAvailable,
        barcode: medicine.barcode,
        registrationDate: medicine.registrationDate,
        expiryDate: medicine.expiryDate,
        createdAt: medicine.createdAt,
        updatedAt: medicine.updatedAt,
        dosageForm: {
          id: medicine.dosage_forms.id,
          name: medicine.dosage_forms.name,
          nameUzbek: medicine.dosage_forms.nameUzbek,
          description: medicine.dosage_forms.description,
        },
        manufacturer: {
          id: medicine.manufacturers.id,
          name: medicine.manufacturers.name,
          country: medicine.manufacturers.country,
          isLocal: medicine.manufacturers.isLocal,
          reliabilityRating: medicine.manufacturers.reliabilityRating ? Number(medicine.manufacturers.reliabilityRating) : undefined,
        },
        activeIngredients: medicine.medicine_active_ingredients.map((mai) => ({
          id: mai.active_ingredients.id,
          name: mai.active_ingredients.name,
          nameLatin: mai.active_ingredients.nameLatin,
          nameUzbek: mai.active_ingredients.nameUzbek,
          atcCode: mai.active_ingredients.atcCode,
          therapeuticClass: mai.active_ingredients.therapeuticClass,
          description: mai.active_ingredients.description,
          warnings: mai.active_ingredients.warnings,
          isNarrowTherapeuticIndex: mai.active_ingredients.isNarrowTherapeuticIndex,
          quantity: mai.quantity ? Number(mai.quantity) : undefined,
          quantityUnit: mai.quantityUnit,
          isPrimary: mai.isPrimary,
        })),
      };
    } catch (error) {
      this.logger.error(`Failed to fetch medicine ${id}: ${error.message}`);
      throw error;
    }
  }

  async findByIngredient(ingredientId: string, paginationDto: PaginationDto): Promise<{
    medicines: MedicineResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    try {
      const [medicines, total] = await Promise.all([
        this.prisma.$queryRaw<MedicineResponseDto[]>`
          SELECT 
            m.id,
            m."tradeName",
            m."registrationNumber",
            m.strength,
            m."packageSize",
            m."priceUzs",
            m."isGeneric",
            m."isAvailable",
            m."prescriptionRequired",
            df.name as "dosageForm",
            mf.name as "manufacturer",
            mf.country as "manufacturerCountry",
            array_agg(DISTINCT ai.name) as "activeIngredients"
          FROM medicines m
          LEFT JOIN dosage_forms df ON m."dosageFormId" = df.id
          LEFT JOIN manufacturers mf ON m."manufacturerId" = mf.id
          LEFT JOIN medicine_active_ingredients mai ON m.id = mai."medicineId"
          LEFT JOIN active_ingredients ai ON mai."activeIngredientId" = ai.id
          WHERE m."isAvailable" = true
            AND mai.active_ingredient_id = ${ingredientId}
          GROUP BY m.id, df.name, mf.name, mf.country
          ORDER BY m.price_uzs ASC NULLS LAST, m.trade_name ASC
          LIMIT ${limit} OFFSET ${skip}
        `,
        this.prisma.medicineActiveIngredient.count({
          where: {
            activeIngredientId: ingredientId,
            medicines: { isAvailable: true },
          },
        }),
      ]);

      return {
        medicines,
        total,
        page,
        limit,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch medicines by ingredient ${ingredientId}: ${error.message}`);
      throw error;
    }
  }
}
