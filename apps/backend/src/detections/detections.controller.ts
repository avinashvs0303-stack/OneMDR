import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { DetectionsService } from './detections.service';
import {
  CreateDetectionDto,
  ToggleDetectionDto,
  ImportDetectionsDto,
  ListDetectionsQueryDto,
} from './dto/create-detection.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('detections')
@ApiBearerAuth('access-token')
@Controller('detections')
@UseGuards(RolesGuard)
@Roles('OWNER', 'ADMIN', 'MEMBER', 'GUEST')
export class DetectionsController {
  constructor(private readonly svc: DetectionsService) {}

  // ── List ─────────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List global + tenant detection rules with enable/disable state' })
  @ApiQuery({ name: 'platform', required: false })
  @ApiQuery({ name: 'severity', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'tactic', required: false })
  @ApiQuery({
    name: 'enabled',
    required: false,
    description: '"true" or "false" to filter by enabled state',
  })
  async list(@Query() query: ListDetectionsQueryDto, @CurrentUser() user: JwtPayload) {
    const data = await this.svc.listDetections(user, query);
    return { data };
  }

  // ── Detail ────────────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get single detection with 90-day stat history' })
  async getOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const data = await this.svc.getDetection(id, user);
    return { data };
  }

  // ── Toggle enable / disable ───────────────────────────────────────────────────

  @Patch(':id/toggle')
  @HttpCode(HttpStatus.OK)
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  @ApiOperation({ summary: 'Enable or disable a detection rule for this tenant' })
  async toggle(
    @Param('id') id: string,
    @Body() dto: ToggleDetectionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const data = await this.svc.toggleDetection(id, dto.enable, user);
    return { data };
  }

  // ── Create custom rule ────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Create a custom detection rule for this tenant' })
  async create(@Body() dto: CreateDetectionDto, @CurrentUser() user: JwtPayload) {
    const data = await this.svc.createDetection(dto, user);
    return { data };
  }

  // ── Excel bulk import ─────────────────────────────────────────────────────────

  @Post('import')
  @HttpCode(HttpStatus.OK)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({
    summary: 'Bulk import custom detection rules from a base64-encoded Excel file',
    description:
      'Required columns: name, query, platform, queryLanguage, severity. ' +
      'Optional: description, mitreAttackId, mitreTactic, mitreTechnique, ' +
      'nistControls (comma-separated), dataSources (comma-separated), tags (comma-separated).',
  })
  async importFile(@Body() dto: ImportDetectionsDto, @CurrentUser() user: JwtPayload) {
    const data = await this.svc.importDetections(dto, user);
    return { data };
  }

  // ── Stats ─────────────────────────────────────────────────────────────────────

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get 90-day daily analytics for a detection rule' })
  async stats(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const data = await this.svc.getStats(id, user);
    return { data };
  }
}
