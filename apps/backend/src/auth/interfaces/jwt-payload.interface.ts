import type { UserRole } from '@clarbit/database';

export interface JwtPayload {
  /** User UUID */
  sub: string;
  tenantId: string;
  role: UserRole;
  email: string;
  /** Issued-at (set by JwtService automatically) */
  iat?: number;
  /** Expiry (set by JwtService automatically) */
  exp?: number;
}
