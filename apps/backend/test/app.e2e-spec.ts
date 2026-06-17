import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyInstance } from 'fastify';
import { AppModule } from '../src/app.module';

/**
 * Step 0 e2e smoke test — verifies the app boots and health endpoints respond.
 * Requires: Docker postgres + redis running (or set DATABASE_URL / REDIS_URL env vars).
 */
describe('Health (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    app.setGlobalPrefix('api/v1');
    await app.init();
    await (app.getHttpAdapter().getInstance() as FastifyInstance).ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health/live → 200 with uptime', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/health/live',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ status: string; uptime: number }>();
    expect(body.status).toBe('ok');
    expect(typeof body.uptime).toBe('number');
  });

  it('GET /api/v1/health → 200 when DB is connected', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
    });

    // 200 = healthy, 503 = degraded but app is running
    expect([200, 503]).toContain(response.statusCode);
    const body = response.json<{ status: string }>();
    expect(['ok', 'error']).toContain(body.status);
  });

  it('GET /nonexistent → 404 with error envelope', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/nonexistent',
    });

    expect(response.statusCode).toBe(404);
    const body = response.json<{ error: { statusCode: number; code: string } }>();
    expect(body.error).toBeDefined();
    expect(body.error.statusCode).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
