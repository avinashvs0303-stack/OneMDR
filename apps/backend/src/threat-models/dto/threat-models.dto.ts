import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsBoolean,
  IsInt,
  Min,
  Max,
  MaxLength,
  IsIn,
} from 'class-validator';

const ENVIRONMENTS = ['CLOUD', 'ONPREM', 'HYBRID'] as const;
const MODEL_STATUSES = ['DRAFT', 'REVIEW', 'APPROVED', 'ARCHIVED'] as const;
const COMPONENT_TYPES = [
  'SERVER',
  'DATABASE',
  'API_GATEWAY',
  'WEBAPP',
  'LOAD_BALANCER',
  'FIREWALL',
  'VPN',
  'S3_BUCKET',
  'IAM_ROLE',
  'CONTAINER',
  'ACTIVE_DIRECTORY',
  'WORKSTATION',
  'SWITCH',
  'MESSAGE_QUEUE',
  'CACHE',
  'CDN',
  'IDENTITY_PROVIDER',
  'MONITORING',
  'DNS',
] as const;
const CLOUD_PROVIDERS = ['AWS', 'AZURE', 'GCP', 'OTHER'] as const;
const CLASSIFICATIONS = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SECRET'] as const;
const THREAT_STATUSES = ['OPEN', 'MITIGATED', 'ACCEPTED', 'FALSE_POSITIVE'] as const;
const STRIDE = [
  'SPOOFING',
  'TAMPERING',
  'REPUDIATION',
  'INFO_DISCLOSURE',
  'DENIAL_OF_SERVICE',
  'ELEVATION_OF_PRIVILEGE',
] as const;

export class CreateModelDto {
  @IsString() @IsNotEmpty() @MaxLength(200) name!: string;
  @IsString() @IsOptional() @MaxLength(2000) description?: string;
  @IsIn(ENVIRONMENTS) environment!: string;
}

export class UpdateModelStatusDto {
  @IsIn(MODEL_STATUSES) status!: string;
}

export class CreateComponentDto {
  @IsString() @IsNotEmpty() @MaxLength(200) name!: string;
  @IsIn(COMPONENT_TYPES) componentType!: string;
  @IsIn(['CLOUD', 'ONPREM']) environment!: string;
  @IsIn(CLOUD_PROVIDERS) @IsOptional() cloudProvider?: string;
  @IsString() @IsOptional() @MaxLength(200) serviceName?: string;
  @IsString() @IsOptional() @MaxLength(1000) notes?: string;
}

export class CreateFlowDto {
  @IsString() @IsNotEmpty() @MaxLength(200) name!: string;
  @IsString() @IsNotEmpty() sourceId!: string;
  @IsString() @IsNotEmpty() targetId!: string;
  @IsString() @IsOptional() @MaxLength(50) protocol?: string;
  @IsIn(CLASSIFICATIONS) @IsOptional() dataClassification?: string;
  @IsBoolean() @IsOptional() isEncrypted?: boolean;
  @IsBoolean() @IsOptional() crossesTrustBoundary?: boolean;
  @IsString() @IsOptional() @MaxLength(1000) notes?: string;
}

export class UpdateThreatDto {
  @IsIn(THREAT_STATUSES) @IsOptional() status?: string;
  @IsInt() @Min(1) @Max(5) @IsOptional() likelihood?: number;
  @IsInt() @Min(1) @Max(5) @IsOptional() impact?: number;
  @IsString() @IsOptional() @MaxLength(2000) mitigationNotes?: string;
}

export class AddThreatDto {
  @IsString() @IsNotEmpty() @MaxLength(300) title!: string;
  @IsString() @IsOptional() @MaxLength(2000) description?: string;
  @IsIn(STRIDE) strideCategory!: string;
  @IsString() @IsOptional() @MaxLength(200) attackTactic?: string;
  @IsString() @IsOptional() @MaxLength(50) attackTechnique?: string;
  @IsInt() @Min(1) @Max(5) likelihood!: number;
  @IsInt() @Min(1) @Max(5) impact!: number;
  @IsString() @IsOptional() componentId?: string;
  @IsString() @IsOptional() flowId?: string;
}
