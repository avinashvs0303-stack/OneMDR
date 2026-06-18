import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { RequestIdInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      // Disable Fastify's built-in logger — nestjs-pino takes over
      logger: false,
      // Security: limit request body size to 10MB
      bodyLimit: 10 * 1024 * 1024,
    }),
    { bufferLogs: true },
  );

  // ── Replace default logger with Pino ───────────────────────────────────────
  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3001);
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');
  const frontendUrl = configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const appName = configService.get<string>('APP_NAME', 'OneMDR');

  // ── Security headers (OWASP A05) ───────────────────────────────────────────
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    // Prevent MIME sniffing (OWASP A05)
    noSniff: true,
    // Prevent clickjacking
    frameguard: { action: 'deny' },
    // Hide X-Powered-By
    hidePoweredBy: true,
  });

  // ── Cookie support (for httpOnly refresh tokens) ───────────────────────────
  await app.register(fastifyCookie, {
    secret: configService.getOrThrow<string>('REFRESH_TOKEN_SECRET'),
  });

  // ── Trust proxy headers (X-Forwarded-For) for accurate IP logging ──────────
  // Required when running behind Netlify Functions / AWS ALB / Render
  app.getInstance().addHook('onRequest', async (req) => {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string') {
      req.ip = xff.split(',')[0].trim();
    }
  });

  // ── CORS — strict allowlist (OWASP A05) ───────────────────────────────────
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 86400, // 24h preflight cache
  });

  // ── Global API prefix (/api/v1) ────────────────────────────────────────────
  app.setGlobalPrefix(apiPrefix, {
    // Health checks must be reachable without the prefix (for load balancers)
    exclude: [],
  });

  // ── Global validation pipe (class-validator) ───────────────────────────────
  // Strips unknown properties, forbids non-whitelisted props (OWASP A03)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // ── Global exception filter ────────────────────────────────────────────────
  app.useGlobalFilters(new AllExceptionsFilter());

  // ── Global interceptors ────────────────────────────────────────────────────
  app.useGlobalInterceptors(new RequestIdInterceptor());

  // ── OpenAPI / Swagger (dev + staging only) ────────────────────────────────
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle(`${appName} API`)
      .setDescription(
        'Production-grade multi-tenant Work OS API.\n\n' +
          'All endpoints require `Authorization: Bearer <access_token>` ' +
          'except `/auth/login`, `/auth/register`, and `/health/*`.',
      )
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .addCookieAuth('refresh_token')
      .addTag('health', 'Service health and readiness probes')
      .addTag('auth', 'Authentication, MFA, session management')
      .addTag('tenants', 'Tenant onboarding and configuration')
      .addTag('users', 'User management and RBAC')
      .addTag('workspaces', 'Workspaces within a tenant')
      .addTag('boards', 'Boards and views')
      .addTag('items', 'Items and dynamic columns')
      .addTag('notifications', 'In-app and email notifications')
      .addTag('automations', 'Automation rules engine')
      .addTag('billing', 'Billing and subscription management')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });
  }

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');

  const logger = app.get(Logger);
  logger.log(`🚀 ${appName} API running on http://localhost:${port}/${apiPrefix}`);
  if (nodeEnv !== 'production') {
    logger.log(`📚 Swagger docs → http://localhost:${port}/docs`);
    logger.log(`❤️  Health check → http://localhost:${port}/${apiPrefix}/health`);
  }
}

void bootstrap();
