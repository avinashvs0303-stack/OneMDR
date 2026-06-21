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
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { HuntsService } from './hunts.service';
import {
  CreateHuntMissionDto,
  UpdateHuntMissionDto,
  CreateHuntEvidenceDto,
  CreateHuntIOCDto,
} from './dto/hunts.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('hunts')
@ApiBearerAuth('access-token')
@Controller('hunts')
@UseGuards(RolesGuard)
@Roles('OWNER', 'ADMIN', 'MEMBER', 'GUEST')
export class HuntsController {
  constructor(private readonly svc: HuntsService) {}

  @Get('stats')
  @ApiOperation({ summary: 'THaaS dashboard stats' })
  stats(@CurrentUser() actor: JwtPayload) {
    return this.svc.stats(actor);
  }

  @Get()
  @ApiOperation({ summary: 'List hunt missions' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'priority', required: false })
  list(
    @CurrentUser() actor: JwtPayload,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
  ) {
    return this.svc.list(actor, status, priority);
  }

  @Get('iocs')
  @ApiOperation({ summary: 'List all IOCs for this tenant' })
  @ApiQuery({ name: 'type', required: false })
  listIOCs(@CurrentUser() actor: JwtPayload, @Query('type') type?: string) {
    return this.svc.listIOCs(actor, type);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a hunt mission with evidence and IOCs' })
  findOne(@CurrentUser() actor: JwtPayload, @Param('id') id: string) {
    return this.svc.findOne(actor, id);
  }

  @Post()
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  @ApiOperation({ summary: 'Create a hunt mission' })
  create(@CurrentUser() actor: JwtPayload, @Body() dto: CreateHuntMissionDto) {
    return this.svc.create(actor, dto);
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  @ApiOperation({ summary: 'Update a hunt mission' })
  update(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateHuntMissionDto,
  ) {
    return this.svc.update(actor, id, dto);
  }

  @Delete(':id')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a hunt mission' })
  remove(@CurrentUser() actor: JwtPayload, @Param('id') id: string) {
    return this.svc.remove(actor, id);
  }

  // ── Evidence ─────────────────────────────────────────────────────────────────

  @Post(':id/evidence')
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  @ApiOperation({ summary: 'Add evidence to a hunt mission' })
  addEvidence(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateHuntEvidenceDto,
  ) {
    return this.svc.addEvidence(actor, id, dto);
  }

  @Delete(':id/evidence/:evidenceId')
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a piece of evidence' })
  removeEvidence(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Param('evidenceId') evidenceId: string,
  ) {
    return this.svc.removeEvidence(actor, id, evidenceId);
  }

  // ── IOCs ──────────────────────────────────────────────────────────────────────

  @Post(':id/iocs')
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  @ApiOperation({ summary: 'Add an IOC to a hunt mission' })
  addIOC(@CurrentUser() actor: JwtPayload, @Param('id') id: string, @Body() dto: CreateHuntIOCDto) {
    return this.svc.addIOC(actor, id, dto);
  }

  @Delete(':id/iocs/:iocId')
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an IOC' })
  removeIOC(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Param('iocId') iocId: string,
  ) {
    return this.svc.removeIOC(actor, id, iocId);
  }
}
