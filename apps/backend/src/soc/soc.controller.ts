import { Controller, Get, Post, Patch, Delete, Param, Query, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SocService } from './soc.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import {
  CreateDocumentDto,
  UpdateDocumentDto,
  CreateChangeDto,
  UpdateChangeStatusDto,
  CreateRequestDto,
  UpdateRequestStatusDto,
  UpsertShiftDto,
  CreateChannelDto,
  SendMessageDto,
} from './dto/soc.dto';

@ApiTags('soc')
@ApiBearerAuth()
@Controller('soc')
export class SocController {
  constructor(private readonly soc: SocService) {}

  // ── Documents ───────────────────────────────────────────────────────────────

  @Get('docs')
  @ApiQuery({ name: 'category', required: false })
  listDocs(@CurrentUser() u: JwtPayload, @Query('category') category?: string) {
    return this.soc.listDocuments(u, category);
  }

  @Get('docs/:id')
  getDoc(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.soc.getDocument(u, id);
  }

  @Post('docs')
  createDoc(@CurrentUser() u: JwtPayload, @Body() dto: CreateDocumentDto) {
    return this.soc.createDocument(u, dto);
  }

  @Patch('docs/:id')
  updateDoc(@CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto: UpdateDocumentDto) {
    return this.soc.updateDocument(u, id, dto);
  }

  @Delete('docs/:id')
  deleteDoc(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.soc.deleteDocument(u, id);
  }

  // ── Change Management ───────────────────────────────────────────────────────

  @Get('changes')
  @ApiQuery({ name: 'status', required: false })
  listChanges(@CurrentUser() u: JwtPayload, @Query('status') status?: string) {
    return this.soc.listChanges(u, status);
  }

  @Post('changes')
  createChange(@CurrentUser() u: JwtPayload, @Body() dto: CreateChangeDto) {
    return this.soc.createChange(u, dto);
  }

  @Patch('changes/:id/status')
  updateChangeStatus(
    @CurrentUser() u: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateChangeStatusDto,
  ) {
    return this.soc.updateChangeStatus(u, id, dto);
  }

  // ── Service Requests ────────────────────────────────────────────────────────

  @Get('requests')
  @ApiQuery({ name: 'status', required: false })
  listRequests(@CurrentUser() u: JwtPayload, @Query('status') status?: string) {
    return this.soc.listRequests(u, status);
  }

  @Post('requests')
  createRequest(@CurrentUser() u: JwtPayload, @Body() dto: CreateRequestDto) {
    return this.soc.createRequest(u, dto);
  }

  @Patch('requests/:id/status')
  updateRequestStatus(
    @CurrentUser() u: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateRequestStatusDto,
  ) {
    return this.soc.updateRequestStatus(u, id, dto);
  }

  // ── Roster ──────────────────────────────────────────────────────────────────

  @Get('roster')
  @ApiQuery({ name: 'weekStart', required: true })
  getRoster(@CurrentUser() u: JwtPayload, @Query('weekStart') weekStart: string) {
    return this.soc.getRosterShifts(u, weekStart);
  }

  @Post('roster/shift')
  upsertShift(@CurrentUser() u: JwtPayload, @Body() dto: UpsertShiftDto) {
    return this.soc.upsertShift(u, dto);
  }

  @Delete('roster/shift/:id')
  clearShift(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.soc.clearShift(u, id);
  }

  // ── Channels ────────────────────────────────────────────────────────────────

  @Get('channels')
  listChannels(@CurrentUser() u: JwtPayload) {
    return this.soc.listChannels(u);
  }

  @Post('channels')
  createChannel(@CurrentUser() u: JwtPayload, @Body() dto: CreateChannelDto) {
    return this.soc.createChannel(u, dto);
  }

  // ── Messages ────────────────────────────────────────────────────────────────

  @Get('channels/:channelId/messages')
  @ApiQuery({ name: 'cursor', required: false })
  getMessages(
    @CurrentUser() u: JwtPayload,
    @Param('channelId') channelId: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.soc.getMessages(u, channelId, cursor);
  }

  @Post('channels/:channelId/messages')
  sendMessage(
    @CurrentUser() u: JwtPayload,
    @Param('channelId') channelId: string,
    @Body() dto: SendMessageDto,
  ) {
    const name = `User ${u.sub.slice(0, 6)}`;
    return this.soc.sendMessage(u, channelId, dto, name);
  }

  @Delete('channels/:channelId/messages/:messageId')
  deleteMessage(
    @CurrentUser() u: JwtPayload,
    @Param('channelId') channelId: string,
    @Param('messageId') messageId: string,
  ) {
    return this.soc.deleteMessage(u, channelId, messageId);
  }
}
