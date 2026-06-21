import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsNumber,
  IsBoolean,
  MinLength,
} from 'class-validator';
import { DetectionSeverity, DetectionPlatform, QueryLanguage } from '@onemdr/database';

const RULE_TYPES = ['ANOMALY', 'INVESTIGATE', 'HIGH_FIDELITY', 'CORRELATION', 'THREAT_INTEL'];
const LIFECYCLE_STAGES = ['EXPERIMENTAL', 'FUNCTIONAL', 'STABLE', 'RETIRED'];
const WORKFLOW_STATUSES = ['PENDING', 'IN_PROGRESS', 'REVIEW', 'APPROVED', 'ENABLED', 'DISABLED'];

export class CreateDetectionDto {
  @IsString()
  @MinLength(3)
  name!: string;

  @IsString()
  description!: string;

  @IsEnum(DetectionSeverity)
  severity!: DetectionSeverity;

  @IsEnum(DetectionPlatform)
  platform!: DetectionPlatform;

  @IsString()
  query!: string;

  @IsEnum(QueryLanguage)
  queryLanguage!: QueryLanguage;

  @IsOptional()
  @IsString()
  mitreAttackId?: string;

  @IsOptional()
  @IsString()
  mitreTactic?: string;

  @IsOptional()
  @IsString()
  mitreTechnique?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  nistControls?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dataSources?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsNumber()
  expectedAlertsPerDay?: number;

  @IsOptional()
  @IsNumber()
  expectedFpRate?: number;

  @IsOptional()
  @IsNumber()
  expectedMttdHours?: number;

  @IsOptional()
  @IsEnum(RULE_TYPES)
  ruleType?: string;

  @IsOptional()
  @IsEnum(LIFECYCLE_STAGES)
  lifecycleStage?: string;

  @IsOptional()
  @IsEnum(WORKFLOW_STATUSES)
  workflowStatus?: string;
}

export class BulkToggleDetectionDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];

  @IsBoolean()
  enable!: boolean;
}

export class ToggleDetectionDto {
  @IsBoolean()
  enable!: boolean;
}

export class ImportDetectionsDto {
  @IsString()
  filename!: string;

  @IsString()
  data!: string; // base64-encoded Excel (.xlsx) file
}

export class ListDetectionsQueryDto {
  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsString()
  severity?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  tactic?: string;

  @IsOptional()
  @IsString()
  enabled?: string; // 'true' | 'false'
}

export class AddLogSourceDto {
  @IsString()
  @MinLength(2)
  logSource!: string; // e.g. "Windows Security", "Firewall Logs"

  @IsOptional()
  @IsString()
  deviceType?: string; // e.g. "Palo Alto PA-5000"

  @IsOptional()
  @IsString()
  vendor?: string; // e.g. "Palo Alto"
}
