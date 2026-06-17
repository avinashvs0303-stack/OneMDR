"use strict";
/**
 * @clarbit/database — re-exports the generated Prisma client.
 *
 * Usage in other packages:
 *   import { PrismaClient, type User, type Tenant, Prisma } from '@clarbit/database';
 *
 * Run `pnpm db:generate` after any schema change to regenerate.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditAction = exports.UserRole = exports.TenantPlan = exports.Prisma = exports.PrismaClient = void 0;
// Re-export everything from the generated client
var client_1 = require("@prisma/client");
Object.defineProperty(exports, "PrismaClient", { enumerable: true, get: function () { return client_1.PrismaClient; } });
Object.defineProperty(exports, "Prisma", { enumerable: true, get: function () { return client_1.Prisma; } });
// Re-export enums
var client_2 = require("@prisma/client");
Object.defineProperty(exports, "TenantPlan", { enumerable: true, get: function () { return client_2.TenantPlan; } });
Object.defineProperty(exports, "UserRole", { enumerable: true, get: function () { return client_2.UserRole; } });
Object.defineProperty(exports, "AuditAction", { enumerable: true, get: function () { return client_2.AuditAction; } });
//# sourceMappingURL=index.js.map