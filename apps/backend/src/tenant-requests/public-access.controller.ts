import { Controller, Post, Body, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { TenantRequestsService } from './tenant-requests.service';
import { SubmitTenantRequestDto } from './dto/submit-tenant-request.dto';
import type { FastifyRequest } from 'fastify';

@ApiTags('access')
@Controller('access')
export class PublicAccessController {
  constructor(private readonly svc: TenantRequestsService) {}

  @Public()
  @SkipThrottle()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a new access request (public)' })
  async submit(@Body() dto: SubmitTenantRequestDto, @Req() req: FastifyRequest) {
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip;
    const device = req.headers['user-agent'];
    const result = await this.svc.submit(dto, { ip, device });
    return {
      data: {
        id: result.id,
        status: result.status,
        contactEmail: result.contactEmail,
        message: 'Your application has been received. We will review it and be in touch shortly.',
      },
    };
  }
}
