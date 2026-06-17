// ── Shared TypeScript types — used by both backend and frontend ───────────────

export type UUID = string;
export type ISODateString = string;

/** Base fields every entity in the system has. */
export interface BaseEntity {
  id: UUID;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  deletedAt?: ISODateString | null;
}

/** Standard API success response wrapper. */
export interface ApiResponse<T> {
  data: T;
  meta: {
    requestId: string;
    timestamp?: string;
  };
}

/** Standard API error envelope (matches AllExceptionsFilter output). */
export interface ApiError {
  error: {
    code: string;
    message: string;
    statusCode: number;
    requestId: string;
    timestamp: string;
    path?: string;
  };
}

// ── RBAC ──────────────────────────────────────────────────────────────────────

export type UserRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';
export type TenantPlan = 'FREE' | 'PRO' | 'ENTERPRISE';

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  GUEST: 1,
};

export function hasRoleOrAbove(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

// ── Column types (Step 4) ─────────────────────────────────────────────────────

export type ColumnType =
  | 'text'
  | 'number'
  | 'status'
  | 'date'
  | 'person'
  | 'dropdown'
  | 'checkbox'
  | 'url'
  | 'email'
  | 'phone'
  | 'rating'
  | 'timeline'
  | 'files';

// ── Board view types (Step 3) ─────────────────────────────────────────────────

export type BoardView = 'table' | 'kanban' | 'timeline' | 'calendar' | 'gallery';
