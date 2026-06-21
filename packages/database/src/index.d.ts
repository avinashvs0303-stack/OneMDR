/**
 * @onemdr/database — re-exports the generated Prisma client.
 *
 * Usage in other packages:
 *   import { PrismaClient, type User, type Tenant, Prisma } from '@onemdr/database';
 *
 * Run `pnpm db:generate` after any schema change to regenerate.
 */
export { PrismaClient, Prisma } from '@prisma/client';
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
  TenantLogSource,
  Integration,
  SiemDeployment,
} from '@prisma/client';
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
  IntegrationStatus,
} from '@prisma/client';
//# sourceMappingURL=index.d.ts.map
