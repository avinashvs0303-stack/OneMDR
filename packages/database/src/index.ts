/**
 * @onemdr/database — re-exports the generated Prisma client.
 *
 * Usage in other packages:
 *   import { PrismaClient, type User, type Tenant, Prisma } from '@onemdr/database';
 *
 * Run `pnpm db:generate` after any schema change to regenerate.
 */

// Re-export everything from the generated client
export { PrismaClient, Prisma } from '@prisma/client';

// Re-export all generated types
export type {
  Tenant,
  User,
  RefreshToken,
  AuditLog,
  PasswordResetToken,
  TenantRequest,
  SupportCase,
  Detection,
  TenantDetection,
  DetectionStat,
} from '@prisma/client';

// Re-export enums
export {
  TenantPlan,
  TenantType,
  UserRole,
  AuditAction,
  TenantRequestStatus,
  SupportCaseStatus,
  SupportCasePriority,
  DetectionSeverity,
  DetectionPlatform,
  QueryLanguage,
} from '@prisma/client';
