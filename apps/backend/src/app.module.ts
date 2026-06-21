import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { validateEnv } from './config/env.config';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { TenantRequestsModule } from './tenant-requests/tenant-requests.module';
import { AdminModule } from './admin/admin.module';
import { DetectionsModule } from './detections/detections.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { HttpThrottlerGuard } from './common/guards/http-throttler.guard';

@Module({
  imports: [
    // ── Config (global) — validates env on startup ──────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      expandVariables: true,
    }),

    // ── Structured logging with Pino ────────────────────────────────────────
    LoggerModule.forRoot({
      pinoHttp: {
        customProps: (req) => ({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          requestId: (req as any).requestId as string | undefined,
        }),
        // Redact sensitive fields from logs — OWASP A09
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.body.password',
            'req.body.currentPassword',
            'req.body.newPassword',
            'req.body.secret',
            'req.body.token',
          ],
          remove: true,
        },
        transport:
          process.env['NODE_ENV'] !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true, colorize: true } }
            : undefined,
        level: process.env['NODE_ENV'] !== 'production' ? 'debug' : 'info',
        // Serialize request/response at info level
        serializers: {
          req(req) {
            return {
              method: req.method,
              url: req.url,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              requestId: (req as any).requestId as string,
            };
          },
        },
      },
    }),

    // ── Event emitter for audit log + domain events ─────────────────────────
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
    }),

    // ── Rate limiting (OWASP A07) ────────────────────────────────────────────
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000, // 1 minute window
        limit: 120, // 120 req/min global default; tighter limits per-route via @Throttle()
      },
    ]),

    // ── Core infrastructure ─────────────────────────────────────────────────
    DatabaseModule,
    HealthModule,

    // ── Feature modules ──────────────────────────────────────────────────────
    AuthModule,
    TenantRequestsModule,
    AdminModule,
    DetectionsModule,
    IntegrationsModule,
    // TenantsModule,     ← Step 2
    // UsersModule,       ← Step 2
    // WorkspacesModule,  ← Step 3
    // BoardsModule,      ← Step 3
    // ItemsModule,       ← Step 4
    // NotificationsModule, ← Step 6
    // AutomationsModule, ← Step 7
    // BillingModule,     ← Step 9
  ],
  providers: [
    // Apply rate limiting globally (individual routes can override with @Throttle)
    { provide: APP_GUARD, useClass: HttpThrottlerGuard },
    // Apply JWT auth globally — routes opt out with @Public()
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
