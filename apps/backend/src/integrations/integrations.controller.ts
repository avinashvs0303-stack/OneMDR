import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';
import { CreateIntegrationDto, UpdateIntegrationDto } from './dto/integrations.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('integrations')
@ApiBearerAuth('access-token')
@Controller('integrations')
@UseGuards(RolesGuard)
@Roles('OWNER', 'ADMIN', 'MEMBER', 'GUEST')
export class IntegrationsController {
  constructor(private readonly svc: IntegrationsService) {}

  @Get()
  @ApiOperation({ summary: 'List SIEM integrations for the tenant' })
  list(@CurrentUser() actor: JwtPayload) {
    return this.svc.list(actor);
  }

  @Get('logs')
  @ApiOperation({ summary: 'Get tenant-wide integration activity logs' })
  getLogs(
    @CurrentUser() actor: JwtPayload,
    @Query('integrationId') integrationId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.getLogs(actor, integrationId, limit ? parseInt(limit, 10) : undefined);
  }

  @Get(':id/logs')
  @ApiOperation({ summary: 'Get activity logs for a single integration' })
  getIntegrationLogs(@CurrentUser() actor: JwtPayload, @Param('id') id: string) {
    return this.svc.getLogs(actor, id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single integration with its deployments' })
  findOne(@CurrentUser() actor: JwtPayload, @Param('id') id: string) {
    return this.svc.findOne(actor, id);
  }

  @Post()
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Add a new SIEM integration' })
  create(@CurrentUser() actor: JwtPayload, @Body() dto: CreateIntegrationDto) {
    return this.svc.create(actor, dto);
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Update integration settings' })
  update(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateIntegrationDto,
  ) {
    return this.svc.update(actor, id, dto);
  }

  @Delete(':id')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an integration' })
  remove(@CurrentUser() actor: JwtPayload, @Param('id') id: string) {
    return this.svc.remove(actor, id);
  }

  @Post(':id/test')
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Test connectivity to the SIEM endpoint' })
  testConnection(@CurrentUser() actor: JwtPayload, @Param('id') id: string) {
    return this.svc.testConnection(actor, id);
  }

  @Post(':id/deploy/:detectionId')
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  @ApiOperation({ summary: 'Deploy a detection rule to this integration' })
  deploy(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Param('detectionId') detectionId: string,
  ) {
    return this.svc.deploy(actor, id, detectionId);
  }

  @Delete(':id/deploy/:detectionId')
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  @ApiOperation({ summary: 'Remove a deployed detection from this integration' })
  undeploy(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Param('detectionId') detectionId: string,
  ) {
    return this.svc.undeploy(actor, id, detectionId);
  }

  @Get('deployments/:detectionId')
  @ApiOperation({ summary: 'List all integration deployments for a detection' })
  listDeployments(@CurrentUser() actor: JwtPayload, @Param('detectionId') detectionId: string) {
    return this.svc.listDeployments(actor, detectionId);
  }
}
