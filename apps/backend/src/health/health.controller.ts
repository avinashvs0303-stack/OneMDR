import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaHealthIndicator } from './prisma-health.indicator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly prismaHealth: PrismaHealthIndicator,
  ) {}

  /** Liveness probe — is the process alive? */
  @Get('live')
  @ApiOperation({ summary: 'Liveness probe (process alive)' })
  live() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  /** Readiness probe — is the app ready to serve traffic? */
  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe (DB + memory)' })
  readiness() {
    return this.health.check([
      () => this.prismaHealth.isHealthy('database'),
      () => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024), // 512 MB
      () => this.memory.checkRSS('memory_rss', 1024 * 1024 * 1024), // 1 GB
    ]);
  }

  /** General health — same as readiness, exposed at /health for convenience */
  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'General health check' })
  check() {
    return this.health.check([
      () => this.prismaHealth.isHealthy('database'),
      () => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024),
    ]);
  }
}
