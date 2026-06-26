import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ThreatModelsService } from './threat-models.service';
import {
  CreateModelDto,
  UpdateModelStatusDto,
  CreateComponentDto,
  CreateFlowDto,
  UpdateThreatDto,
  AddThreatDto,
} from './dto/threat-models.dto';

@ApiTags('threat-models')
@ApiBearerAuth('access-token')
@UseGuards(RolesGuard)
@Roles('OWNER', 'ADMIN', 'MEMBER')
@Controller('threat-models')
export class ThreatModelsController {
  constructor(private readonly svc: ThreatModelsService) {}

  // ── Models ────────────────────────────────────────────────────────────────

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.svc.listModels(user);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateModelDto) {
    return this.svc.createModel(user, dto);
  }

  @Get(':id')
  getOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.svc.getModel(user, id);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateModelStatusDto,
  ) {
    return this.svc.updateModelStatus(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.svc.deleteModel(user, id);
  }

  // ── Components ────────────────────────────────────────────────────────────

  @Post(':id/components')
  addComponent(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateComponentDto,
  ) {
    return this.svc.addComponent(user, id, dto);
  }

  @Delete(':id/components/:cid')
  @HttpCode(HttpStatus.OK)
  removeComponent(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('cid') cid: string,
  ) {
    return this.svc.deleteComponent(user, id, cid);
  }

  // ── Data Flows ────────────────────────────────────────────────────────────

  @Post(':id/flows')
  addFlow(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: CreateFlowDto) {
    return this.svc.addFlow(user, id, dto);
  }

  @Delete(':id/flows/:fid')
  @HttpCode(HttpStatus.OK)
  removeFlow(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Param('fid') fid: string) {
    return this.svc.deleteFlow(user, id, fid);
  }

  // ── STRIDE generation ─────────────────────────────────────────────────────

  @Post(':id/generate-threats')
  @HttpCode(HttpStatus.OK)
  generateThreats(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.svc.generateThreats(user, id);
  }

  // ── Threats ───────────────────────────────────────────────────────────────

  @Get(':id/threats')
  listThreats(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.svc.listThreats(user, id);
  }

  @Post(':id/threats')
  addThreat(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: AddThreatDto) {
    return this.svc.addThreat(user, id, dto);
  }

  @Patch(':id/threats/:tid')
  updateThreat(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('tid') tid: string,
    @Body() dto: UpdateThreatDto,
  ) {
    return this.svc.updateThreat(user, id, tid, dto);
  }

  @Delete(':id/threats/:tid')
  @HttpCode(HttpStatus.OK)
  removeThreat(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('tid') tid: string,
  ) {
    return this.svc.deleteThreat(user, id, tid);
  }

  // ── Risk summary ──────────────────────────────────────────────────────────

  @Get(':id/risk-summary')
  riskSummary(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.svc.getRiskSummary(user, id);
  }
}
