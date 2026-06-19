# OneMDR — Auth & Security Architecture

## Stack

- **Frontend**: Next.js 15 (App Router) + React 19, hosted on Netlify
- **Backend**: NestJS 10 + Fastify v4, hosted on Railway
- **Database**: PostgreSQL 16 via Supabase (pooled connection)
- **Auth**: Supabase Auth (GoTrue) — replaces all custom JWT/cookie management

---

## Auth Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (Netlify — onemdr.netlify.app)                     │
│  Next.js 15 + @supabase/ssr                                 │
│                                                             │
│  ┌─────────────────────┐  ┌──────────────────────────────┐ │
│  │  Supabase browser   │  │  Zustand auth.store          │ │
│  │  client             │  │  user: AuthUser (from JWT)   │ │
│  │  signInWithPassword │  │  accessToken: string         │ │
│  │  signOut            │  │  isAuthenticated: boolean    │ │
│  │  onAuthStateChange  │  └──────────────────────────────┘ │
│  │  resetPasswordFor   │                                   │
│  │  Email              │                                   │
│  └──────┬──────────────┘                                   │
└─────────│───────────────────────────────────────────────────┘
          │ HTTPS + httpOnly cookies (sb-*-auth-token)
          ▼
┌─────────────────────────┐    ┌──────────────────────────────┐
│  Supabase Auth (GoTrue) │    │  Railway (NestJS + Fastify)  │
│                         │    │                              │
│  ✓ Email+password login │    │  ✓ Verifies Supabase JWT     │
│  ✓ Invite by email      │    │    (SUPABASE_JWT_SECRET)     │
│  ✓ Password reset email │    │  ✓ Reads app_metadata claims │
│  ✓ Email verification   │    │  ✓ tenant_id scoping on all  │
│  ✓ JWT signing (HS256)  │    │    Prisma queries            │
│  ✓ Refresh token        │    │  ✓ RBAC via RolesGuard       │
│    rotation             │    │  ✓ MFA (TOTP) — Phase 1     │
│  ✓ OAuth (Google/MSFT)  │    │  ✓ Audit logging             │
│  ✓ Brute-force protect  │    │  ✓ Rate limiting             │
│  ✓ SOC 2 Type II        │    │                              │
└─────────────────────────┘    └──────────────┬───────────────┘
                                              │ Prisma (service_role)
                                              ▼
                               ┌──────────────────────────────┐
                               │  Supabase PostgreSQL         │
                               │  tenants, users, audit_logs  │
                               │  RLS: deny-all restrictive   │
                               │  (service_role bypasses RLS) │
                               └──────────────────────────────┘
```

---

## Supabase JWT Payload

Supabase issues JWTs signed with `SUPABASE_JWT_SECRET`. Railway verifies these JWTs locally
(no network call). Custom claims are injected into `app_metadata` by Railway's service_role —
this field is **read-only from the browser**, making it the trusted security boundary.

```json
{
  "sub": "supabase-auth-user-uuid",
  "email": "owner@acme.com",
  "aud": "authenticated",
  "role": "authenticated",
  "app_metadata": {
    "user_id": "our-users-table-uuid",
    "tenant_id": "tenant-uuid",
    "app_role": "OWNER",
    "provider": "email"
  },
  "user_metadata": {
    "first_name": "John",
    "last_name": "Doe"
  }
}
```

> **Rule**: Never trust `user_metadata` for auth decisions — users can write it.
> Only `app_metadata` (set by service_role) is authoritative for `tenant_id` and `app_role`.

---

## Auth Flows

### 1. New Customer Onboarding (Invite-Only)

```
Visitor → /auth/register (Request Access form)
  → POST /api/v1/tenant-requests (no auth, public)
  → TenantRequest record created with PENDING status

Super Admin reviews at /admin/tenant-requests
  → POST /api/v1/tenant-requests/:id/approve

Railway (approve handler):
  1. Creates Tenant record in DB (plan, modules, license)
  2. Creates users record (role=OWNER, tenantId, firstName, lastName)
  3. Calls supabase.auth.admin.inviteUserByEmail(email)
     → Supabase sends invite email with magic link
  4. Calls supabase.auth.admin.updateUserById(supabaseUid, {
       app_metadata: { user_id, tenant_id, app_role: "OWNER" }
     })
  5. Stores supabase_uid in users record for future lookups
  6. Returns confirmation (no temp password exposed)

User clicks invite email → /auth/set-password
  → supabase.auth.updateUser({ password: newPassword })
  → Email auto-verified (invite flow), session issued
  → router.push('/modules')
```

### 2. Login

```
/auth/login
  → supabase.auth.signInWithPassword({ email, password })
  → Supabase verifies, issues JWT + refresh token
  → Sets httpOnly sb-*-auth-token cookie
  → supabase.auth.onAuthStateChange(SIGNED_IN)
  → SessionRestorer maps Supabase session → AuthUser → Zustand
  → middleware sees cookie → allows /modules
```

### 3. Logout

```
useAuthStore.logout()
  → supabase.auth.signOut()
  → Supabase revokes refresh token on server
  → Supabase clears sb-*-auth-token cookie
  → Zustand clearSession()
  → Next request: middleware sees no cookie → /auth/login
```

### 4. Silent Token Refresh

```
@supabase/ssr middleware: on each request, if token is expiring →
  automatically rotates via Supabase refresh endpoint →
  sets new cookie in response →
  no manual /auth/refresh call needed

supabase.auth.onAuthStateChange(TOKEN_REFRESHED) →
  SessionRestorer updates Zustand accessToken
```

### 5. Forgot Password

```
/auth/forgot-password → enter email
  → supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://app.com/auth/reset-password'
    })
  → Supabase sends reset email (Railway not involved)

User clicks link → /auth/reset-password
  → supabase.auth.updateUser({ password: newPassword })
  → router.push('/auth/login')
```

### 6. Email Verification

Handled automatically by the invite flow (invite link = verified).
For any future self-signup: configure Supabase to require email confirmation.
Unverified users (`email_confirmed_at = null`) are blocked at login.

### 7. OAuth (Google / Microsoft)

```
→ supabase.auth.signInWithOAuth({ provider: 'google' })
→ Supabase redirects to Google → back to /auth/callback
→ /auth/callback: supabase.auth.exchangeCodeForSession()
→ If app_metadata.user_id exists → normal login flow
→ If not (first-time OAuth) → user needs to be invited first
```

OAuth providers must be configured in: Supabase Dashboard → Auth → Providers.

---

## Multi-Tenant Zero-Trust

### Three Security Layers

**Layer 1 — JWT Boundary (network)**
Every Railway API request must carry `Authorization: Bearer <supabase-jwt>`.
`JwtStrategy` reads `app_metadata.tenant_id` from the verified JWT.
No `tenant_id` in token = 401 Unauthorized. No exceptions.

**Layer 2 — Application Scoping (service layer)**
All Prisma queries are scoped to `tenantId` from the JWT. Pattern:

```typescript
// ALWAYS — never read all rows
await prisma.detection.findMany({
  where: { tenantId: user.tenantId },
});
```

Services never accept `tenantId` from request body — only from verified JWT.

**Layer 3 — Database RLS (database layer)**
Deny-all `AS RESTRICTIVE` policies on all tables (see `002_rls_policies.sql`).
Backend uses `service_role` which bypasses RLS for performance.
RLS acts as a fail-safe: even if application scoping is bypassed, the DB
rejects cross-tenant reads.

---

## RBAC

Roles (lowest → highest privilege):

| Role        | Scope    | Can                                    |
| ----------- | -------- | -------------------------------------- |
| GUEST       | Tenant   | Read-only access                       |
| MEMBER      | Tenant   | Create/read resources                  |
| ADMIN       | Tenant   | Manage members, all resources          |
| OWNER       | Tenant   | Full tenant control, billing           |
| SUPER_ADMIN | Platform | Manage all tenants, approve onboarding |

Enforced by:

1. `JwtAuthGuard` (global APP_GUARD) — Supabase JWT on every request
2. `RolesGuard` + `@Roles()` decorator — checks `app_metadata.app_role`
3. `ClarbitEmailGuard` — restricts `/admin/*` to `@clarbit.com` emails

SUPER_ADMIN is platform-level, not tenant-scoped. Created via Supabase dashboard
or Railway service_role — never via self-signup.

---

## Security Controls

| Control          | Implementation                                  | Standard  |
| ---------------- | ----------------------------------------------- | --------- |
| Authentication   | Supabase Auth (GoTrue)                          | OWASP A07 |
| JWT signing      | HS256 via Supabase, verified by Railway         | RFC 7519  |
| Password hashing | bcrypt (GoTrue default, 10 rounds)              | OWASP A02 |
| MFA              | Custom TOTP (Railway) — Phase 1                 | OWASP A07 |
| Token rotation   | Supabase (family-based reuse detection)         | OWASP A07 |
| Rate limiting    | NestJS Throttler (120/min global, 10/min auth)  | OWASP A04 |
| Cookie security  | httpOnly, Secure, SameSite=Lax (Supabase)       | OWASP A02 |
| XSS prevention   | Tokens in httpOnly cookies, not localStorage    | OWASP A03 |
| CSRF protection  | SameSite=Lax + Fastify CORS allowlist           | OWASP A01 |
| SQL injection    | Prisma ORM (parameterized, no raw strings)      | OWASP A03 |
| Field encryption | AES-256-GCM for MFA secrets                     | OWASP A02 |
| Input validation | Zod (backend DTOs) + react-hook-form (frontend) | OWASP A03 |
| Secrets          | Env vars only, never in source code             | OWASP A02 |
| Audit trail      | Immutable append-only `audit_logs` table        | OWASP A09 |
| Log redaction    | Pino redact: authorization, cookie, passwords   | OWASP A09 |
| HTTP headers     | Fastify Helmet (CSP, HSTS, X-Frame-Options)     | OWASP A05 |

---

## Environment Variables

### Railway (Backend) — never exposed to browser

```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # Admin operations only
SUPABASE_JWT_SECRET=<jwt-secret>               # Dashboard → Settings → API
ENCRYPTION_KEY=<64-hex-chars>                  # AES-256 for MFA secrets
DATABASE_URL=<supabase-pooler-url>             # For runtime queries
DIRECT_URL=<supabase-direct-url>               # For migrations only
FRONTEND_URL=https://onemdr.netlify.app
NODE_ENV=production
```

### Netlify (Frontend) — safe to expose (enforced by RLS)

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
NEXT_PUBLIC_API_URL=https://onemdr.netlify.app/api/v1
```

---

## Key Design Decisions

| Decision                        | Rationale                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------- |
| Invite-only onboarding          | No public self-signup; all tenants approved by Clarbit                            |
| Supabase Auth (not custom JWT)  | Battle-tested, SOC 2, handles all edge cases we were fixing manually              |
| Railway for business logic only | Clean separation; Railway never issues auth tokens                                |
| `app_metadata` for claims       | Only service_role can write it — browser cannot forge `tenant_id` or `app_role`   |
| No tokens in sessionStorage     | httpOnly Supabase cookies prevent XSS token theft                                 |
| Middleware uses `getSession()`  | Fast (reads from cookie, no HTTP); actual security enforced by Railway JWT verify |
| SUPER_ADMIN not tenant-scoped   | Platform role created in DB, not via any user-facing flow                         |

---

## Security Audit Status (2026-06-19)

### Completed

- [x] Multi-tenant RLS policies (deny-all restrictive) — `002_rls_policies.sql`
- [x] Auth delegated to Supabase (removed all custom JWT/cookie bugs)
- [x] Removed GEMINI_API_KEY from codebase
- [x] CORS allowlist on Edge Functions
- [x] `ClarbitEmailGuard` — admin panel restricted to @clarbit.com
- [x] `supabase_uid` linkage — our users table linked to Supabase auth.users

### Remaining

- [ ] Input validation on `extension_id`, `module_key` params (backend DTOs)
- [ ] Password strength policy (enforce in Supabase Auth settings)
- [ ] CSP headers (add to Netlify `_headers` file)
- [ ] Supabase native MFA (Phase 2 — replaces custom TOTP)
- [ ] OAuth callback validation (verify `app_metadata.user_id` exists on OAuth login)
