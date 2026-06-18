import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@onemdr/database';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
        ...(process.env['NODE_ENV'] !== 'production'
          ? [{ level: 'query' as const, emit: 'event' as const }]
          : []),
      ],
    });

    // Forward Prisma events to NestJS logger
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.$on as any)('warn', (e: { message: string }) => {
      this.logger.warn(e.message);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.$on as any)('error', (e: { message: string }) => {
      this.logger.error(e.message);
    });
    if (process.env['NODE_ENV'] !== 'production') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.$on as any)('query', (e: { query: string; duration: number }) => {
        this.logger.debug(`Query (${e.duration}ms): ${e.query}`);
      });
    }
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Database connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  /**
   * Sets the current tenant context for RLS policies.
   * Called by TenantGuard on every authenticated request.
   * Uses SET LOCAL so the GUC only applies within the current transaction.
   */
  async setTenantContext(tenantId: string): Promise<void> {
    await this.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
  }

  /**
   * Soft-delete helper: sets deleted_at instead of deleting the row.
   */
  async softDelete(model: string, id: string): Promise<void> {
    await this.$executeRawUnsafe(
      `UPDATE "${model}" SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
      id,
    );
  }
}
