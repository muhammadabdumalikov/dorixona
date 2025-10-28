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
        nameLatin: ingredient.nameLatin,
        nameUzbek: ingredient.nameUzbek,
        atcCode: ingredient.atcCode,
        therapeuticClass: ingredient.therapeuticClass,
        description: ingredient.description,
        warnings: ingredient.warnings,
        isNarrowTherapeuticIndex: ingredient.isNarrowTherapeuticIndex,
        createdAt: ingredient.createdAt,
        updatedAt: ingredient.updatedAt,
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
        nameLatin: activeIngredient.nameLatin,
        nameUzbek: activeIngredient.nameUzbek,
        atcCode: activeIngredient.atcCode,
        therapeuticClass: activeIngredient.therapeuticClass,
        description: activeIngredient.description,
        warnings: activeIngredient.warnings,
        isNarrowTherapeuticIndex: activeIngredient.isNarrowTherapeuticIndex,
        createdAt: activeIngredient.createdAt,
        updatedAt: activeIngredient.updatedAt,
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
          ai."nameLatin",
          ai."nameUzbek",
          ai."atcCode",
          ai."therapeuticClass",
          ai.description,
          ai.warnings,
          ai."isNarrowTherapeuticIndex",
          ai."createdAt",
          ai."updatedAt",
          COUNT(mai.id) as "medicineCount"
        FROM active_ingredients ai
        LEFT JOIN medicine_active_ingredients mai ON ai.id = mai."activeIngredientId"
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
