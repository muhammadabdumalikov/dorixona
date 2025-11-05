import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private currentTenantId: string | null = null;

  async onModuleInit() {
    await this.$connect();
    this.setupTenantMiddleware();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Set the current tenant ID for tenant-scoped queries
   */
  setTenantId(tenantId: string | null) {
    this.currentTenantId = tenantId;
  }

  /**
   * Get the current tenant ID
   */
  getTenantId(): string | null {
    return this.currentTenantId;
  }

  /**
   * Setup Prisma middleware to automatically filter by tenant_id
   * Note: This is a simple implementation. For production, consider using
   * Prisma's row-level security or more sophisticated middleware.
   */
  private setupTenantMiddleware() {
    // Middleware will be applied at the service level for better control
    // We'll handle tenant filtering in individual services
  }
}
