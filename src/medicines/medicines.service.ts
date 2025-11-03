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
            m."trade_name",
            m."registration_number",
            m.strength,
            m."package_size",
            m."price_uzs",
            m."is_generic",
            m."is_available",
            m."prescription_required",
            df.name as "dosage_form",
            mf.name as "manufacturer",
            mf.country as "manufacturer_country",
            array_agg(DISTINCT ai.name) as "active_ingredients"
          FROM medicines m
          LEFT JOIN dosage_forms df ON m."dosage_form_id" = df.id
          LEFT JOIN manufacturers mf ON m."manufacturer_id" = mf.id
          LEFT JOIN medicine_active_ingredients mai ON m.id = mai."medicine_id"
          LEFT JOIN active_ingredients ai ON mai."active_ingredient_id" = ai.id
          WHERE m."is_available" = true
          GROUP BY m.id, df.name, mf.name, mf.country
          ORDER BY m."trade_name" ASC
          LIMIT ${limit} OFFSET ${skip}
        `,
        this.prisma.medicine.count({
          where: { is_available: true },
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
        trade_name: medicine.trade_name,
        registration_number: medicine.registration_number,
        strength: medicine.strength,
        strength_numeric: medicine.strength_numeric ? Number(medicine.strength_numeric) : undefined,
        strength_unit: medicine.strength_unit,
        package_size: medicine.package_size,
        package_quantity: medicine.package_quantity,
        price_uzs: medicine.price_uzs ? Number(medicine.price_uzs) : undefined,
        price_last_updated: medicine.price_last_updated,
        prescription_required: medicine.prescription_required,
        is_generic: medicine.is_generic,
        is_available: medicine.is_available,
        barcode: medicine.barcode,
        registration_date: medicine.registration_date,
        expiry_date: medicine.expiry_date,
        created_at: medicine.created_at,
        updated_at: medicine.updated_at,
        dosage_form: {
          id: medicine.dosage_forms.id,
          name: medicine.dosage_forms.name,
          name_uzbek: medicine.dosage_forms.name_uzbek,
          description: medicine.dosage_forms.description,
        },
        manufacturer: {
          id: medicine.manufacturers.id,
          name: medicine.manufacturers.name,
          country: medicine.manufacturers.country,
          is_local: medicine.manufacturers.is_local,
          reliability_rating: medicine.manufacturers.reliability_rating ? Number(medicine.manufacturers.reliability_rating) : undefined,
        },
        active_ingredients: medicine.medicine_active_ingredients.map((mai) => ({
          id: mai.active_ingredients.id,
          name: mai.active_ingredients.name,
          name_latin: mai.active_ingredients.name_latin,
          name_uzbek: mai.active_ingredients.name_uzbek,
          atc_code: mai.active_ingredients.atc_code,
          therapeutic_class: mai.active_ingredients.therapeutic_class,
          description: mai.active_ingredients.description,
          warnings: mai.active_ingredients.warnings,
          is_narrow_therapeutic_index: mai.active_ingredients.is_narrow_therapeutic_index,
          quantity: mai.quantity ? Number(mai.quantity) : undefined,
          quantity_unit: mai.quantity_unit,
          is_primary: mai.is_primary,
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
            m."trade_name",
            m."registration_number",
            m.strength,
            m."package_size",
            m."price_uzs",
            m."is_generic",
            m."is_available",
            m."prescription_required",
            df.name as "dosage_form",
            mf.name as "manufacturer",
            mf.country as "manufacturer_country",
            array_agg(DISTINCT ai.name) as "active_ingredients"
          FROM medicines m
          LEFT JOIN dosage_forms df ON m."dosage_form_id" = df.id
          LEFT JOIN manufacturers mf ON m."manufacturer_id" = mf.id
          LEFT JOIN medicine_active_ingredients mai ON m.id = mai."medicine_id"
          LEFT JOIN active_ingredients ai ON mai."active_ingredient_id" = ai.id
          WHERE m."is_available" = true
            AND mai.active_ingredient_id = ${ingredientId}
          GROUP BY m.id, df.name, mf.name, mf.country
          ORDER BY m.price_uzs ASC NULLS LAST, m.trade_name ASC
          LIMIT ${limit} OFFSET ${skip}
        `,
        this.prisma.medicineActiveIngredient.count({
          where: {
            active_ingredient_id: ingredientId,
            medicines: { is_available: true },
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
