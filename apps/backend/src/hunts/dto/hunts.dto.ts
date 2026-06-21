import { IsString, IsEnum, IsOptional, IsArray, IsDateString, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum HuntStatusDto {
  PLANNED = 'PLANNED',
  ACTIVE = 'ACTIVE',
  COMPLETE = 'COMPLETE',
  ARCHIVED = 'ARCHIVED',
}

export enum HuntPriorityDto {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export enum HuntEvidenceTypeDto {
  FINDING = 'FINDING',
  FALSE_POSITIVE = 'FALSE_POSITIVE',
  ARTIFACT = 'ARTIFACT',
  NOTE = 'NOTE',
}

export enum HuntIOCTypeDto {
  IP = 'IP',
  DOMAIN = 'DOMAIN',
  HASH_MD5 = 'HASH_MD5',
  HASH_SHA1 = 'HASH_SHA1',
  HASH_SHA256 = 'HASH_SHA256',
  URL = 'URL',
  EMAIL = 'EMAIL',
  REGISTRY_KEY = 'REGISTRY_KEY',
  FILE_PATH = 'FILE_PATH',
  OTHER = 'OTHER',
}

export class CreateHuntMissionDto {
  @ApiProperty() @IsString() title: string;
  @ApiProperty() @IsString() hypothesis: string;
  @ApiPropertyOptional({ enum: HuntPriorityDto })
  @IsOptional()
  @IsEnum(HuntPriorityDto)
  priority?: HuntPriorityDto;
  @ApiPropertyOptional() @IsOptional() @IsString() tacticId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() tactic?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() techniques?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() analystName?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() startDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class UpdateHuntMissionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() hypothesis?: string;
  @ApiPropertyOptional({ enum: HuntStatusDto })
  @IsOptional()
  @IsEnum(HuntStatusDto)
  status?: HuntStatusDto;
  @ApiPropertyOptional({ enum: HuntPriorityDto })
  @IsOptional()
  @IsEnum(HuntPriorityDto)
  priority?: HuntPriorityDto;
  @ApiPropertyOptional() @IsOptional() @IsString() tacticId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() tactic?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() techniques?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() analystName?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() startDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class CreateHuntEvidenceDto {
  @ApiPropertyOptional({ enum: HuntEvidenceTypeDto })
  @IsOptional()
  @IsEnum(HuntEvidenceTypeDto)
  type?: HuntEvidenceTypeDto;
  @ApiProperty() @IsString() title: string;
  @ApiProperty() @IsString() body: string;
  @ApiPropertyOptional() @IsOptional() @IsString() severity?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isFalsePositive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() analystName?: string;
}

export class CreateHuntIOCDto {
  @ApiProperty({ enum: HuntIOCTypeDto }) @IsEnum(HuntIOCTypeDto) type: HuntIOCTypeDto;
  @ApiProperty() @IsString() value: string;
  @ApiPropertyOptional() @IsOptional() @IsString() confidence?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
