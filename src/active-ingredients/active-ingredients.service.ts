import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { PaginationDto } from '../common/dtos/pagination.dto';
import { ActiveIngredientDto } from './dto/active-ingredient.dto';

@Injectable()
export class ActiveIngredientsService {
  private readonly logger = new Logger(ActiveIngredientsService.name);

  constructor(private prisma: PrismaService) { }

  async findAll(paginationDto: PaginationDto): Promise<{
    activeIngredients: ActiveIngredientDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20 } = paginationDto;
    const skip = (page - 1) * limit;

    try {
      const [activeIngredients, total] = await Promise.all([
        this.prisma.activeIngredient.findMany({
          skip,
          take: limit,
          orderBy: { name: 'asc' },
          include: {
            _count: {
              select: {
                medicine_active_ingredients: true,
              },
            },
          },
        }),
        this.prisma.activeIngredient.count(),
      ]);

      const activeIngredientsWithCount = activeIngredients.map(ingredient => ({
        id: ingredient.id,
        name: ingredient.name,
        nameLatin: ingredient.name_latin,
        nameUzbek: ingredient.name_uzbek,
        atcCode: ingredient.atc_code,
        therapeuticClass: ingredient.therapeutic_class,
        description: ingredient.description,
        warnings: ingredient.warnings,
        isNarrowTherapeuticIndex: ingredient.is_narrow_therapeutic_index,
        createdAt: ingredient.created_at,
        updatedAt: ingredient.updated_at,
        medicineCount: ingredient._count.medicine_active_ingredients,
      }));

      return {
        activeIngredients: activeIngredientsWithCount,
        total,
        page,
        limit,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch active ingredients: ${error.message}`);
      throw error;
    }
  }

  async findOne(id: string): Promise<ActiveIngredientDto> {
    try {
      const activeIngredient = await this.prisma.activeIngredient.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              medicine_active_ingredients: true,
            },
          },
        },
      });

      if (!activeIngredient) {
        throw new Error(`Active ingredient with ID ${id} not found`);
      }

      return {
        id: activeIngredient.id,
        name: activeIngredient.name,
        nameLatin: activeIngredient.name_latin,
        nameUzbek: activeIngredient.name_uzbek,
        atcCode: activeIngredient.atc_code,
        therapeuticClass: activeIngredient.therapeutic_class,
        description: activeIngredient.description,
        warnings: activeIngredient.warnings,
        isNarrowTherapeuticIndex: activeIngredient.is_narrow_therapeutic_index,
        createdAt: activeIngredient.created_at,
        updatedAt: activeIngredient.updated_at,
        medicineCount: activeIngredient._count.medicine_active_ingredients,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch active ingredient ${id}: ${error.message}`);
      throw error;
    }
  }

  async search(query: string, limit = 20): Promise<ActiveIngredientDto[]> {
    try {
      const activeIngredients = await this.prisma.$queryRaw<ActiveIngredientDto[]>`
        SELECT 
          ai.id,
          ai.name,
          ai."name_latin",
          ai."name_uzbek",
          ai."atc_code",
          ai."therapeutic_class",
          ai.description,
          ai.warnings,
          ai."is_narrow_therapeutic_index",
          ai."created_at",
          ai."updated_at",
          COUNT(mai.id) as "medicine_count"
        FROM active_ingredients ai
        LEFT JOIN medicine_active_ingredients mai ON ai.id = mai."active_ingredient_id"
        WHERE ai.name ILIKE ${`%${query}%`}
          OR ai.name_latin ILIKE ${`%${query}%`}
          OR ai.name_uzbek ILIKE ${`%${query}%`}
          OR similarity(ai.name, ${query}) > 0.3
        GROUP BY ai.id
        ORDER BY similarity(ai.name, ${query}) DESC, ai.name ASC
        LIMIT ${limit}
      `;

      return activeIngredients;
    } catch (error) {
      this.logger.error(`Failed to search active ingredients: ${error.message}`);
      throw error;
    }
  }
}
