# OneMDR — Master Skill Reference (by Clarbit)

> **Always read this file before touching any code in this repo.**  
> It is the single source of truth for architecture decisions, security rules, workflow commands, and coding conventions.

---

## 1. Project Identity

| Property            | Value                                                                      |
| ------------------- | -------------------------------------------------------------------------- |
| **Product**         | OneMDR — multi-tenant MDR platform (DaaS, THaaS, CaaS and more) by Clarbit |
| **Stage**           | Production-grade SaaS, built incrementally                                 |
| **Package manager** | pnpm 9 + Turborepo 2                                                       |
| **Build target**    | Node 20 LTS                                                                |

---

## 2. Monorepo Structure

```
clarbit-Detection-as-a-Service/
├── apps/
│   ├── backend/        # NestJS 10 + Fastify — REST + WebSocket API
│   └── frontend/       # Next.js 15 App Router + React 19
├── packages/
│   ├── database/       # Prisma schema, migrations, typed client
│   └── shared/         # Shared Zod schemas, TypeScript types, constants
├── docker/
│   └── postgres/       # init.sql (RLS setup, extensions)
├── .github/
│   └── workflows/      # CI: lint → typecheck → test → build
├── SKILL.md            # ← YOU ARE HERE
├── docker-compose.yml
├── turbo.json
└── .env.example
```

Package names: `@onemdr/backend`, `@onemdr/frontend`, `@onemdr/database`, `@onemdr/shared`

---

## 3. Tech Stack — Rationale

### Backend

- **NestJS 10 + Fastify** — modular DI framework, 2× faster than Express under load. Fastify is the platform; `@nestjs/platform-fastify` bridges them.
- **Prisma 5** — typed SQL, migration runner, introspection. Postgres dialect. Schema lives in `packages/database/prisma/schema.prisma`.
- **BullMQ + Redis** — queues for automations, email dispatch, webhook delivery. Never do heavy work in the request cycle.
- **Zod** — env validation (`validateEnv`), shared schema contracts.  
  **class-validator + class-transformer** — DTO validation inside NestJS pipes.
- **Pino + nestjs-pino** — structured JSON logging. Never use `console.log` in production code.
- **@nestjs/terminus** — `/api/v1/health` (liveness), `/api/v1/health/ready` (DB + Redis).
- **@nestjs/swagger** — auto-generated OpenAPI at `/docs` (non-production only).

### Frontend

- **Next.js 15 App Router** — Server Components by default; Client Components only when needed (interactivity, hooks, real-time).
- **TanStack Query v5** — server state, cache, background refetching.
- **Zustand v4** — client-only UI state (modals, sidebar open/close, optimistic updates).
- **React Hook Form + Zod** — all forms validated with the same schemas as backend.
- **Tailwind CSS + shadcn/ui** — utility-first; components in `src/components/ui/`.
- **Socket.IO client** — real-time board collaboration (Step 5+).

### Database

- **PostgreSQL 16** — primary store.
- **Multi-tenancy model**: shared database, `tenant_id` column on every tenant-scoped table, enforced via:
  1. Application-layer: NestJS middleware injects `tenantId` from JWT into every service call.
  2. Database-layer: Postgres RLS policies as second safety net.
- **Row-Level Security** — enabled on all tenant-scoped tables. Policies set `app.current_tenant_id` via `SET LOCAL`.
- **Soft deletes** — `deleted_at TIMESTAMPTZ` on every table; never hard-delete.
- **Audit log** — `audit_logs` table records every mutating event.

---

## 4. Architecture Layers (Backend)

```
HTTP request
    │
    ▼
[Guard] AuthGuard → TenantGuard → PermissionGuard
    │
    ▼
[Controller]   — validates DTO, calls service, returns response
    │
    ▼
[Service]      — ALL business logic lives here
    │
    ▼
[Repository]   — DB access via PrismaService (always scoped to tenantId)
    │
    ▼
[PrismaService] — extends PrismaClient; enforces tenant scope middleware
```

**Rules:**

- No business logic in controllers. Controllers map HTTP ↔ service calls.
- No raw SQL in services. All DB access via Prisma.
- Every `findMany` must accept `PaginationDto` (page, limit, sort, order).
- Every mutation emits an `AuditEvent` via `EventEmitter2`.

---

## 5. Multi-Tenancy Rules — NEVER SKIP

1. **Every** database query against a tenant-scoped table MUST include `WHERE tenant_id = :tenantId`.
2. `tenantId` comes from the verified JWT payload — never from request body or query params.
3. The `TenantGuard` runs before all protected routes and attaches `request.tenant` to the request context.
4. Postgres RLS is the second safety net, NOT the primary one.
5. When adding a new table: ask "is this tenant-scoped?" If yes → add `tenant_id`, enable RLS, add policy, add index.

```sql
-- Template for every new tenant-scoped table RLS policy:
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON <table>
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

---

## 6. Security Checklist (OWASP Top 10 + ASVS)

| #   | Control                   | Where implemented                                           |
| --- | ------------------------- | ----------------------------------------------------------- |
| A01 | Broken Access Control     | TenantGuard + PermissionGuard + RLS                         |
| A02 | Cryptographic Failures    | Argon2id passwords, AES-256-GCM field encryption, TLS       |
| A03 | Injection                 | Prisma parameterized queries, class-validator on all inputs |
| A04 | Insecure Design           | RBAC (owner/admin/member/guest), resource-level checks      |
| A05 | Security Misconfiguration | Helmet, strict CORS, validated env, no debug in prod        |
| A06 | Vulnerable Components     | npm audit in CI, Dependabot alerts                          |
| A07 | Auth Failures             | Argon2id, rate limiting, account lockout, MFA (TOTP)        |
| A08 | Software Integrity        | Lockfile CI check, no untrusted CDN scripts                 |
| A09 | Logging Failures          | Pino structured logs, immutable audit_log table             |
| A10 | SSRF                      | Allowlist-based URL validation for webhooks                 |

**Auth token rules:**

- Access token: JWT, 15-minute TTL, signed with `JWT_SECRET`, contains `{ sub, tenantId, role, email }`.
- Refresh token: opaque random bytes, stored hashed in DB, 7-day TTL, sent as `httpOnly Secure SameSite=Strict` cookie.
- Refresh token rotation: on every use, old token is revoked and a new one issued.
- Reuse detection: if an already-revoked refresh token is presented, revoke the entire token family.

---

## 7. RBAC Matrix

| Permission       | OWNER | ADMIN | MEMBER |      GUEST      |
| ---------------- | :---: | :---: | :----: | :-------------: |
| Delete tenant    |  ✅   |  ❌   |   ❌   |       ❌        |
| Manage members   |  ✅   |  ✅   |   ❌   |       ❌        |
| Enforce MFA      |  ✅   |  ✅   |   ❌   |       ❌        |
| Create workspace |  ✅   |  ✅   |   ❌   |       ❌        |
| Create board     |  ✅   |  ✅   |   ✅   |       ❌        |
| Edit items       |  ✅   |  ✅   |   ✅   |       ❌        |
| View boards      |  ✅   |  ✅   |   ✅   | ✅ (if invited) |
| View audit log   |  ✅   |  ✅   |   ❌   |       ❌        |

---

## 8. API Conventions

- **Base**: `http://localhost:3001/api/v1`
- **Versioning**: URL prefix `/api/v1`. When breaking changes arrive: `/api/v2` new module, `/api/v1` kept for grace period.
- **Pagination**: `GET /boards?page=1&limit=25&sort=createdAt&order=desc`
- **Response envelope** (success):
  ```json
  { "data": {...}, "meta": { "requestId": "uuid" } }
  ```
- **Response envelope** (paginated):
  ```json
  { "data": [...], "meta": { "page": 1, "limit": 25, "total": 100, "totalPages": 4 } }
  ```
- **Error envelope**:
  ```json
  {
    "error": { "code": "BOARD_NOT_FOUND", "message": "...", "statusCode": 404, "requestId": "uuid" }
  }
  ```
- **Audit**: Every POST/PUT/PATCH/DELETE route MUST fire an audit event via `this.eventEmitter.emit('audit.log', payload)`.

---

## 9. Environment Variables

All env vars are validated with Zod on startup via `validateEnv()` in `apps/backend/src/config/env.config.ts`.  
The app exits with a clear error if any required var is missing or malformed — fail fast.

| Variable                  | Required | Notes                                          |
| ------------------------- | -------- | ---------------------------------------------- |
| `DATABASE_URL`            | ✅       | Postgres connection string                     |
| `REDIS_URL`               | ✅       | Redis connection string (with password)        |
| `JWT_SECRET`              | ✅       | min 32 chars, use `openssl rand -hex 32`       |
| `REFRESH_TOKEN_SECRET`    | ✅       | min 32 chars, separate from JWT                |
| `ENCRYPTION_KEY`          | ✅       | exactly 32 bytes, for AES-256 field encryption |
| `GOOGLE_CLIENT_ID/SECRET` | Optional | OAuth (Step 1)                                 |
| `SMTP_*`                  | Optional | Email via SMTP (Step 6)                        |

**Never hardcode secrets. Never log them. In production: AWS Secrets Manager or HashiCorp Vault.**

---

## 10. Commands Reference

```bash
# ── Bootstrap (first time) ───────────────────────────────────────
cp .env.example .env               # fill in your local secrets
pnpm install                       # install all workspace deps
docker compose up -d               # start postgres + redis
pnpm db:generate                   # generate Prisma client
pnpm db:migrate                    # run migrations

# ── Daily development ────────────────────────────────────────────
docker compose up -d               # ensure infra is running
pnpm dev                           # start all apps in watch mode (turbo)
pnpm --filter @onemdr/backend dev # backend only (port 3001)
pnpm --filter @onemdr/frontend dev # frontend only (port 3000)

# ── Database ─────────────────────────────────────────────────────
pnpm db:generate                   # regenerate Prisma client after schema change
pnpm db:migrate                    # create + apply migration (dev)
pnpm db:migrate:deploy             # apply existing migrations (prod/CI)
pnpm db:studio                     # Prisma Studio GUI
pnpm db:seed                       # seed demo data

# ── Quality ──────────────────────────────────────────────────────
pnpm lint                          # ESLint all packages
pnpm typecheck                     # tsc --noEmit all packages
pnpm test                          # unit tests (Jest)
pnpm test:e2e                      # e2e tests (supertest)
pnpm build                         # production build (turbo)

# ── Swagger ──────────────────────────────────────────────────────
# http://localhost:3001/docs        (dev only)
# http://localhost:3001/api/v1/health  (health check)
```

---

## 11. Step Build Order

| Step  | Feature                                                     | Branch convention           |
| ----- | ----------------------------------------------------------- | --------------------------- |
| **0** | Scaffold monorepo, Prisma init, health check, CI ← **DONE** | `feat/step-0-scaffold`      |
| **1** | Auth: email/password + Google OAuth + JWT + MFA (TOTP)      | `feat/step-1-auth`          |
| **2** | Tenants, users, RBAC, session management                    | `feat/step-2-tenants-rbac`  |
| **3** | Workspaces + Boards                                         | `feat/step-3-boards`        |
| **4** | Items + dynamic typed columns                               | `feat/step-4-items-columns` |
| **5** | Real-time (WebSocket gateway, presence, optimistic UI)      | `feat/step-5-realtime`      |
| **6** | Notifications (in-app + email queue)                        | `feat/step-6-notifications` |
| **7** | Automations engine                                          | `feat/step-7-automations`   |
| **8** | Dashboards + reporting                                      | `feat/step-8-dashboards`    |
| **9** | Billing (Stripe scaffold)                                   | `feat/step-9-billing`       |

---

## 12. Testing Strategy

- **Unit tests** (`*.spec.ts`) — test services in isolation; mock PrismaService.
- **Integration tests** (`*.e2e-spec.ts`) — hit real DB via Testcontainers or docker-compose test DB.
- **Auth/security tests** — verify: unauthenticated → 401, wrong tenant → 403, rate limit trigger, MFA bypass attempts.
- **Coverage gate**: 80% for services.
- Run tests: `pnpm test` (watch: `pnpm test -- --watch`).

---

## 13. Git & PR Rules

- Commit with `feat/fix/chore/docs/refactor/test` prefixes (Conventional Commits).
- Never commit `.env` files. Never commit secrets.
- Pre-commit: Husky runs lint-staged (ESLint + Prettier on changed files).
- CI must pass before merging: lint + typecheck + test + build.
- DB migrations run automatically in CI against a fresh Postgres container.

---

## 14. Adding a New Module (NestJS)

```
apps/backend/src/<module>/
├── <module>.module.ts        # @Module declaration
├── <module>.controller.ts    # HTTP endpoints, @ApiTags, @UseGuards
├── <module>.service.ts       # business logic
├── <module>.repository.ts    # DB access via PrismaService
├── dto/
│   ├── create-<module>.dto.ts
│   └── update-<module>.dto.ts
└── <module>.spec.ts          # service unit test
```

Always add the module to `AppModule` imports. Always add `@ApiTags('<module>')` to the controller.

---

## 15. Security Non-Negotiables

These are **never** skippable, even in early steps:

1. `TenantGuard` on every protected route — no exceptions.
2. Input validation DTO on every endpoint that accepts a body.
3. Never trust client-supplied `tenantId` or `userId` — always derive from JWT.
4. Passwords hashed with Argon2id (not bcrypt, not SHA-256).
5. Refresh tokens stored as SHA-256 hash in DB, never plaintext.
6. Audit log entry on every auth event and permission change.
7. Rate limiting on `/auth/*` endpoints.
8. Never return stack traces or internal error details to clients in production.
