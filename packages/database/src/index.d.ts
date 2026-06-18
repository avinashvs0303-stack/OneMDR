/**
 * @onemdr/database — re-exports the generated Prisma client.
 *
 * Usage in other packages:
 *   import { PrismaClient, type User, type Tenant, Prisma } from '@onemdr/database';
 *
 * Run `pnpm db:generate` after any schema change to regenerate.
 */
export { PrismaClient, Prisma } from '@prisma/client';
export type { Tenant, User, RefreshToken, AuditLog, PasswordResetToken } from '@prisma/client';
export { TenantPlan, UserRole, AuditAction } from '@prisma/client';
//# sourceMappingURL=index.d.ts.map
