import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { SearchDto } from './dto/search.dto';
import { MedicineResponseDto } from './dto/medicine-response.dto';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(private prisma: PrismaService) { }

  async searchMedicines(searchDto: SearchDto): Promise<MedicineResponseDto[]> {
    const { query, limit = 20 } = searchDto;

    this.logger.log(`Searching for medicines with query: "${query}"`);

    try {
      // Use raw SQL for trigram similarity search
      const medicines = await this.prisma.$queryRaw<MedicineResponseDto[]>`
        SELECT DISTINCT
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
          array_agg(DISTINCT ai.name) as "active_ingredients",
          GREATEST(
            similarity(m."trade_name", ${query}),
            similarity(ai.name, ${query})
          ) as similarity_score
        FROM medicines m
        LEFT JOIN dosage_forms df ON m."dosage_form_id" = df.id
        LEFT JOIN manufacturers mf ON m."manufacturer_id" = mf.id
        LEFT JOIN medicine_active_ingredients mai ON m.id = mai."medicine_id"
        LEFT JOIN active_ingredients ai ON mai."active_ingredient_id" = ai.id
        WHERE m."is_available" = true
          AND (
            m."trade_name" ILIKE ${`%${query}%`}
            OR ai.name ILIKE ${`%${query}%`}
            OR similarity(m."trade_name", ${query}) > 0.3
            OR similarity(ai.name, ${query}) > 0.3
          )
        GROUP BY m.id, df.name, mf.name, mf.country
        ORDER BY similarity_score DESC, m."trade_name" ASC
        LIMIT ${limit}
      `;

      // Log search for analytics
      await this.logSearch(query, medicines.length);

      return medicines;
    } catch (error) {
      this.logger.error(`Search failed: ${error.message}`);
      throw error;
    }
  }

  async searchByActiveIngredient(ingredientName: string, limit = 20): Promise<MedicineResponseDto[]> {
    this.logger.log(`Searching medicines by active ingredient: "${ingredientName}"`);

    try {
      const medicines = await this.prisma.$queryRaw<MedicineResponseDto[]>`
        SELECT DISTINCT
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
          AND ai.name ILIKE ${`%${ingredientName}%`}
        GROUP BY m.id, df.name, mf.name, mf.country
        ORDER BY m."price_uzs" ASC NULLS LAST, m."trade_name" ASC
        LIMIT ${limit}
      `;

      return medicines;
    } catch (error) {
      this.logger.error(`Search by ingredient failed: ${error.message}`);
      throw error;
    }
  }

  private async logSearch(query: string, resultsCount: number): Promise<void> {
    try {
      await this.prisma.userSearch.create({
        data: {
          search_query: query,
          results_count: resultsCount,
          user_ip: '127.0.0.1', // In production, get from request
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to log search: ${error.message}`);
    }
  }
}
