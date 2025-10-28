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

      if (!sourceMedicine.isAvailable) {
        throw new NotFoundException(
          `Medicine with ID ${medicineId} is not available`,
        );
      }

      // Get active ingredient IDs
      const activeIngredientIds =
        sourceMedicine.medicine_active_ingredients.map(
          (mai) => mai.activeIngredientId,
        );

      if (activeIngredientIds.length === 0) {
        return [];
      }

      // Find medicines with the same active ingredients
      const alternatives = await this.prisma.$queryRaw<AlternativeDto[]>`
        WITH medicine_ingredients AS (
          SELECT 
            m.id,
            m."tradeName",
            m.strength,
            m."strengthNumeric",
            m."strengthUnit",
            m."packageSize",
            m."priceUzs",
            m."isGeneric",
            m."prescriptionRequired",
            df.name as dosage_form,
            mf.name as manufacturer,
            mf.country as manufacturer_country,
            array_agg(ai.id) as active_ingredient_ids,
            array_agg(ai.name) as active_ingredient_names,
            array_agg(ai."isNarrowTherapeuticIndex") as narrow_therapeutic_flags
          FROM medicines m
          LEFT JOIN dosage_forms df ON m."dosageFormId" = df.id
          LEFT JOIN manufacturers mf ON m."manufacturerId" = mf.id
          LEFT JOIN medicine_active_ingredients mai ON m.id = mai."medicineId"
          LEFT JOIN active_ingredients ai ON mai."activeIngredientId" = ai.id
          WHERE m."isAvailable" = true
            AND m.id != ${medicineId}::uuid
          GROUP BY m.id, m."tradeName", m.strength, m."strengthNumeric", m."strengthUnit", m."packageSize", m."priceUzs", m."isGeneric", m."prescriptionRequired", df.name, mf.name, mf.country
        )
        SELECT 
          mi.id,
          mi."tradeName",
          mi.strength,
          mi."packageSize",
          mi."priceUzs",
          mi."isGeneric",
          mi."prescriptionRequired",
          mi.dosage_form as "dosageForm",
          mi.manufacturer,
          mi.manufacturer_country as "manufacturerCountry",
          mi.active_ingredient_names as "activeIngredients",
          CASE 
            WHEN ${sourceMedicine.priceUzs} IS NOT NULL AND mi."priceUzs" IS NOT NULL 
            THEN ${sourceMedicine.priceUzs} - mi."priceUzs" 
            ELSE NULL 
          END as savings,
          CASE 
            WHEN ${sourceMedicine.priceUzs} IS NOT NULL AND mi."priceUzs" IS NOT NULL AND ${sourceMedicine.priceUzs} > 0
            THEN ROUND((((${sourceMedicine.priceUzs} - mi."priceUzs") / ${sourceMedicine.priceUzs}) * 100), 2)
            ELSE NULL 
          END as "savingsPercentage",
          CASE 
            WHEN array_length(mi.active_ingredient_ids, 1) = ${activeIngredientIds.length}
              AND mi.active_ingredient_ids @> ${activeIngredientIds}::uuid[]
              AND mi.active_ingredient_ids <@ ${activeIngredientIds}::uuid[]
            THEN true
            ELSE false
          END as "exactMatch",
          CASE 
            WHEN mi.dosage_form = ${sourceMedicine.dosage_forms.name}
            THEN true
            ELSE false
          END as "sameDosageForm",
          CASE 
            WHEN mi."strengthNumeric" = ${sourceMedicine.strengthNumeric}
              AND mi."strengthUnit" = ${sourceMedicine.strengthUnit}
            THEN true
            ELSE false
          END as "sameStrength",
          CASE 
            WHEN true = ANY(mi.narrow_therapeutic_flags)
            THEN true
            ELSE false
          END as "hasNarrowTherapeuticIndex"
        FROM medicine_ingredients mi
        WHERE array_length(mi.active_ingredient_ids, 1) = ${activeIngredientIds.length}
          AND mi.active_ingredient_ids @> ${activeIngredientIds}::uuid[]
          AND mi.active_ingredient_ids <@ ${activeIngredientIds}::uuid[]
        ORDER BY 
          "exactMatch" DESC,
          "sameDosageForm" DESC,
          "sameStrength" DESC,
          mi."priceUzs" ASC NULLS LAST,
          mi."tradeName" ASC
      `;

      // Add disclaimer and warnings
      const alternativesWithDisclaimer = alternatives.map((alt) => ({
        ...alt,
        disclaimer: StrengthParser.getDisclaimer(),
        warnings: alt.hasNarrowTherapeuticIndex
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
      .filter((alt) => alt.priceUzs !== null)
      .sort((a, b) => (a.priceUzs || 0) - (b.priceUzs || 0))
      .slice(0, limit);

    return cheapestAlternatives;
  }
}
