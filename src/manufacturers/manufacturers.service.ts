import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { PaginationDto } from '../common/dtos/pagination.dto';
import { ManufacturerDto } from './dto/manufacturer.dto';

@Injectable()
export class ManufacturersService {
  private readonly logger = new Logger(ManufacturersService.name);

  constructor(private prisma: PrismaService) { }

  async findAll(paginationDto: PaginationDto): Promise<{
    manufacturers: ManufacturerDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20 } = paginationDto;
    const skip = (page - 1) * limit;

    try {
      const [manufacturers, total] = await Promise.all([
        this.prisma.manufacturer.findMany({
          skip,
          take: limit,
          orderBy: { name: 'asc' },
          include: {
            _count: {
              select: {
                medicines: true,
              },
            },
          },
        }),
        this.prisma.manufacturer.count(),
      ]);

      const manufacturersWithCount = manufacturers.map(manufacturer => ({
        id: manufacturer.id,
        name: manufacturer.name,
        country: manufacturer.country,
        isLocal: manufacturer.is_local,
        reliabilityRating: manufacturer.reliability_rating ? Number(manufacturer.reliability_rating) : undefined,
        createdAt: manufacturer.created_at,
        updatedAt: manufacturer.updated_at,
        medicineCount: manufacturer._count.medicines,
      }));

      return {
        manufacturers: manufacturersWithCount,
        total,
        page,
        limit,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch manufacturers: ${error.message}`);
      throw error;
    }
  }

  async findOne(id: string): Promise<ManufacturerDto> {
    try {
      const manufacturer = await this.prisma.manufacturer.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              medicines: true,
            },
          },
        },
      });

      if (!manufacturer) {
        throw new Error(`Manufacturer with ID ${id} not found`);
      }

      return {
        id: manufacturer.id,
        name: manufacturer.name,
        country: manufacturer.country,
        isLocal: manufacturer.is_local,
        reliabilityRating: manufacturer.reliability_rating ? Number(manufacturer.reliability_rating) : undefined,
        createdAt: manufacturer.created_at,
        updatedAt: manufacturer.updated_at,
        medicineCount: manufacturer._count.medicines,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch manufacturer ${id}: ${error.message}`);
      throw error;
    }
  }

  async search(query: string, limit = 20): Promise<ManufacturerDto[]> {
    try {
      const manufacturers = await this.prisma.$queryRaw<ManufacturerDto[]>`
        SELECT 
          m.id,
          m.name,
          m.country,
          m."is_local",
          m."reliability_rating",
          m."created_at",
          m."updated_at",
          COUNT(med.id) as "medicineCount"
        FROM manufacturers m
        LEFT JOIN medicines med ON m.id = med."manufacturer_id"
        WHERE m.name ILIKE ${`%${query}%`}
          OR m.country ILIKE ${`%${query}%`}
          OR similarity(m.name, ${query}) > 0.3
        GROUP BY m.id
        ORDER BY similarity(m.name, ${query}) DESC, m.name ASC
        LIMIT ${limit}
      `;

      return manufacturers;
    } catch (error) {
      this.logger.error(`Failed to search manufacturers: ${error.message}`);
      throw error;
    }
  }

  async getLocalManufacturers(): Promise<ManufacturerDto[]> {
    try {
      const manufacturers = await this.prisma.manufacturer.findMany({
        where: { is_local: true },
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: {
              medicines: true,
            },
          },
        },
      });

      return manufacturers.map(manufacturer => ({
        id: manufacturer.id,
        name: manufacturer.name,
        country: manufacturer.country,
        isLocal: manufacturer.is_local,
        reliabilityRating: manufacturer.reliability_rating ? Number(manufacturer.reliability_rating) : undefined,
        createdAt: manufacturer.created_at,
        updatedAt: manufacturer.updated_at,
        medicineCount: manufacturer._count.medicines,
      }));
    } catch (error) {
      this.logger.error(`Failed to fetch local manufacturers: ${error.message}`);
      throw error;
    }
  }
}
