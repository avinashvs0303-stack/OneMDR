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
  CreatePlaybookDto,
  UpdatePlaybookDto,
  LaunchPlaybookDto,
  RunPlaybookQueryDto,
  CreateScheduleDto,
  UpdateScheduleDto,
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

  // ── Stats ─────────────────────────────────────────────────────────────────────

  @Get('stats')
  @ApiOperation({ summary: 'THaaS dashboard stats' })
  stats(@CurrentUser() actor: JwtPayload) {
    return this.svc.stats(actor);
  }

  // ── Playbooks (before :id routes) ────────────────────────────────────────────

  @Get('playbooks')
  @ApiOperation({ summary: 'List all playbooks (global + tenant custom)' })
  listPlaybooks(@CurrentUser() actor: JwtPayload) {
    return this.svc.listPlaybooks(actor);
  }

  @Get('playbooks/:id')
  @ApiOperation({ summary: 'Get a playbook with its schedules' })
  getPlaybook(@CurrentUser() actor: JwtPayload, @Param('id') id: string) {
    return this.svc.getPlaybook(actor, id);
  }

  @Post('playbooks')
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  @ApiOperation({ summary: 'Create a custom playbook' })
  createPlaybook(@CurrentUser() actor: JwtPayload, @Body() dto: CreatePlaybookDto) {
    return this.svc.createPlaybook(actor, dto);
  }

  @Patch('playbooks/:id')
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  @ApiOperation({ summary: 'Update a custom playbook' })
  updatePlaybook(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdatePlaybookDto,
  ) {
    return this.svc.updatePlaybook(actor, id, dto);
  }

  @Delete('playbooks/:id')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a custom playbook' })
  deletePlaybook(@CurrentUser() actor: JwtPayload, @Param('id') id: string) {
    return this.svc.deletePlaybook(actor, id);
  }

  @Post('playbooks/:id/launch')
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  @ApiOperation({ summary: 'Launch a hunt mission from a playbook' })
  launchPlaybook(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: LaunchPlaybookDto,
  ) {
    return this.svc.launchPlaybook(actor, id, dto);
  }

  @Post('playbooks/run-query')
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  @ApiOperation({ summary: 'Run a Splunk query from a playbook (ad-hoc preview)' })
  runPlaybookQuery(@CurrentUser() actor: JwtPayload, @Body() dto: RunPlaybookQueryDto) {
    return this.svc.runPlaybookQuery(actor, dto);
  }

  // ── Schedules ─────────────────────────────────────────────────────────────────

  @Get('schedules')
  @ApiOperation({ summary: 'List all hunt schedules' })
  listSchedules(@CurrentUser() actor: JwtPayload) {
    return this.svc.listSchedules(actor);
  }

  @Get('schedules/:id')
  @ApiOperation({ summary: 'Get a hunt schedule with run history' })
  getSchedule(@CurrentUser() actor: JwtPayload, @Param('id') id: string) {
    return this.svc.getSchedule(actor, id);
  }

  @Post('schedules')
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Create a hunt schedule' })
  createSchedule(@CurrentUser() actor: JwtPayload, @Body() dto: CreateScheduleDto) {
    return this.svc.createSchedule(actor, dto);
  }

  @Patch('schedules/:id')
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Update a hunt schedule' })
  updateSchedule(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.svc.updateSchedule(actor, id, dto);
  }

  @Delete('schedules/:id')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a hunt schedule' })
  deleteSchedule(@CurrentUser() actor: JwtPayload, @Param('id') id: string) {
    return this.svc.deleteSchedule(actor, id);
  }

  @Post('schedules/:id/trigger')
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  @ApiOperation({ summary: 'Manually trigger a hunt schedule run now' })
  triggerSchedule(@CurrentUser() actor: JwtPayload, @Param('id') id: string) {
    return this.svc.triggerSchedule(actor, id);
  }

  // ── Missions ──────────────────────────────────────────────────────────────────

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

  // ── Evidence ──────────────────────────────────────────────────────────────────

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
