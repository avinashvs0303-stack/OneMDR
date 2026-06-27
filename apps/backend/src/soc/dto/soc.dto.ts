import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  Min,
  Max,
} from 'class-validator';

// ── Documents ─────────────────────────────────────────────────────────────────

export class CreateDocumentDto {
  @ApiProperty() @IsString() title: string;
  @ApiProperty() @IsString() content: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}

export class UpdateDocumentDto {
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() content?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPinned?: boolean;
}

// ── Change Management ─────────────────────────────────────────────────────────

export class CreateChangeDto {
  @ApiProperty() @IsString() title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['STANDARD', 'NORMAL', 'EMERGENCY'])
  changeType?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'])
  priority?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'])
  riskLevel?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() impact?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() rollbackPlan?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() scheduledStart?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() scheduledEnd?: string;
}

export class UpdateChangeStatusDto {
  @ApiProperty()
  @IsIn(['DRAFT', 'REVIEW', 'APPROVED', 'IMPLEMENTING', 'COMPLETED', 'REJECTED'])
  status: string;
  @ApiPropertyOptional() @IsOptional() @IsString() rejectionNote?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() approverName?: string;
}

// ── Service Requests ──────────────────────────────────────────────────────────

export class CreateRequestDto {
  @ApiProperty() @IsString() title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['ACCESS', 'TOOL', 'REPORT', 'TRAINING', 'INTEGRATION', 'OTHER'])
  category?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(['HIGH', 'MEDIUM', 'LOW']) priority?: string;
}

export class UpdateRequestStatusDto {
  @ApiProperty()
  @IsIn(['OPEN', 'IN_PROGRESS', 'PENDING_APPROVAL', 'RESOLVED', 'CANCELLED'])
  status: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assigneeName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() resolutionNote?: string;
}

// ── Roster ────────────────────────────────────────────────────────────────────

export class UpsertShiftDto {
  @ApiProperty() @IsString() weekStart: string;
  @ApiProperty() @IsIn(['MORNING', 'AFTERNOON', 'NIGHT', 'GENERAL']) shiftType: string;
  @ApiProperty() @IsInt() @Min(1) @Max(7) dayOfWeek: number;
  @ApiPropertyOptional() @IsOptional() @IsString() analystId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() analystName?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isOncall?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

// ── Channels ──────────────────────────────────────────────────────────────────

export class CreateChannelDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPrivate?: boolean;
}

// ── Messages ──────────────────────────────────────────────────────────────────

export class SendMessageDto {
  @ApiProperty() @IsString() content: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(['TEXT', 'ALERT', 'FILE']) messageType?: string;
}

// ── Incidents ────────────────────────────────────────────────────────────────

export class CreateIncidentDto {
  @ApiPropertyOptional() @IsOptional() @IsString() severity?: string;
  @ApiProperty() @IsString() title!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assigneeName?: string;
}

export class UpdateIncidentStatusDto {
  @ApiProperty() @IsString() status!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assigneeName?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() slaBreached?: boolean;
}

// ── Permission Groups ────────────────────────────────────────────────────────

export class CreateGroupDto {
  @ApiProperty() @IsString() name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() color?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) permissions?: string[];
}

export class UpdateGroupDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() color?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) permissions?: string[];
}

export class GroupMembershipDto {
  @ApiProperty() @IsString() userId!: string;
}
