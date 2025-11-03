import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { StrengthParser } from '../common/utils/strength-parser.util';
import { AlternativeDto } from './dto/alternative.dto';

@Injectable()
export class AlternativesService {
  private readonly logger = new Logger(AlternativesService.name);

  constructor(private prisma: PrismaService) { }

  async findAlternatives(medicineId: string): Promise<AlternativeDto[]> {
    this.logger.log(`Finding alternatives for medicine: ${medicineId}`);

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(medicineId)) {
      throw new NotFoundException(`Invalid medicine ID format: ${medicineId}`);
    }

    try {
      // Get the source medicine with its active ingredients
      const sourceMedicine = await this.prisma.medicine.findUnique({
        where: { id: medicineId },
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

      if (!sourceMedicine) {
        throw new NotFoundException(`Medicine with ID ${medicineId} not found`);
      }

      if (!sourceMedicine.is_available) {
        throw new NotFoundException(
          `Medicine with ID ${medicineId} is not available`,
        );
      }

      // Get active ingredient IDs
      const activeIngredientIds =
        sourceMedicine.medicine_active_ingredients.map(
          (mai) => mai.active_ingredient_id,
        );

      if (activeIngredientIds.length === 0) {
        return [];
      }

      // Find medicines with the same active ingredients
      const alternatives = await this.prisma.$queryRaw<AlternativeDto[]>`
        WITH medicine_ingredients AS (
          SELECT 
            m.id,
            m."trade_name",
            m.strength,
            m."strength_numeric",
            m."strength_unit",
            m."package_size",
            m."price_uzs",
            m."is_generic",
            m."prescription_required",
            df.name as dosage_form,
            mf.name as manufacturer,
            mf.country as manufacturer_country,
            array_agg(ai.id) as active_ingredient_ids,
            array_agg(ai.name) as active_ingredient_names,
            array_agg(ai."is_narrow_therapeutic_index") as narrow_therapeutic_flags
          FROM medicines m
          LEFT JOIN dosage_forms df ON m."dosage_form_id" = df.id
          LEFT JOIN manufacturers mf ON m."manufacturer_id" = mf.id
          LEFT JOIN medicine_active_ingredients mai ON m.id = mai."medicine_id"
          LEFT JOIN active_ingredients ai ON mai."active_ingredient_id" = ai.id
          WHERE m."is_available" = true
            AND m.id != ${medicineId}::uuid
          GROUP BY m.id, m."trade_name", m.strength, m."strength_numeric", m."strength_unit", m."package_size", m."price_uzs", m."is_generic", m."prescription_required", df.name, mf.name, mf.country
        )
        SELECT 
          mi.id,
          mi."trade_name",
          mi.strength,
          mi."package_size",
          mi."price_uzs",
          mi."is_generic",
          mi."prescription_required",
          mi.dosage_form as "dosage_form",
          mi.manufacturer,
          mi.manufacturer_country as "manufacturer_country",
          mi.active_ingredient_names as "active_ingredients",
          CASE 
            WHEN ${sourceMedicine.price_uzs}::decimal IS NOT NULL AND mi."price_uzs" IS NOT NULL 
            THEN ${sourceMedicine.price_uzs}::decimal - mi."price_uzs" 
            ELSE NULL 
          END as savings,
          CASE 
            WHEN ${sourceMedicine.price_uzs}::decimal IS NOT NULL AND mi."price_uzs" IS NOT NULL AND ${sourceMedicine.price_uzs}::decimal > 0
            THEN ROUND((((${sourceMedicine.price_uzs}::decimal - mi."price_uzs") / ${sourceMedicine.price_uzs}::decimal) * 100), 2)
            ELSE NULL 
          END as "savings_percentage",
          CASE 
            WHEN array_length(mi.active_ingredient_ids, 1) = ${activeIngredientIds.length}::int
              AND mi.active_ingredient_ids @> ${activeIngredientIds}::uuid[]
              AND mi.active_ingredient_ids <@ ${activeIngredientIds}::uuid[]
            THEN true
            ELSE false
          END as "exact_match",
          CASE 
            WHEN mi.dosage_form = ${sourceMedicine.dosage_forms.name}::text
            THEN true
            ELSE false
          END as "same_dosage_form",
          CASE 
            WHEN mi."strength_numeric" = ${sourceMedicine.strength_numeric}::decimal
              AND mi."strength_unit" = ${sourceMedicine.strength_unit}::text
            THEN true
            ELSE false
          END as "same_strength",
          CASE 
            WHEN true = ANY(mi.narrow_therapeutic_flags)
            THEN true
            ELSE false
          END as "has_narrow_therapeutic_index"
        FROM medicine_ingredients mi
        WHERE array_length(mi.active_ingredient_ids, 1) = ${activeIngredientIds.length}::int
          AND mi.active_ingredient_ids @> ${activeIngredientIds}::uuid[]
          AND mi.active_ingredient_ids <@ ${activeIngredientIds}::uuid[]
        ORDER BY 
          "exact_match" DESC,
          "same_dosage_form" DESC,
          "same_strength" DESC,
          mi."price_uzs" ASC NULLS LAST,
          mi."trade_name" ASC
      `;

      // Add disclaimer and warnings
      const alternativesWithDisclaimer = alternatives.map((alt) => ({
        ...alt,
        disclaimer: StrengthParser.getDisclaimer(),
        warnings: alt.has_narrow_therapeutic_index
          ? 'This medicine contains narrow therapeutic index ingredients. Consult your doctor before switching.'
          : null,
      }));

      this.logger.log(
        `Found ${alternativesWithDisclaimer.length} alternatives for medicine ${medicineId}`,
      );
      return alternativesWithDisclaimer;
    } catch (error) {
      this.logger.error(`Failed to find alternatives: ${error.message}`);
      throw error;
    }
  }

  async findCheapestAlternatives(
    medicineId: string,
    limit = 10,
  ): Promise<AlternativeDto[]> {
    const alternatives = await this.findAlternatives(medicineId);

    // Filter and sort by price
    const cheapestAlternatives = alternatives
      .filter((alt) => alt.price_uzs !== null)
      .sort((a, b) => (a.price_uzs || 0) - (b.price_uzs || 0))
      .slice(0, limit);

    return cheapestAlternatives;
  }
}
