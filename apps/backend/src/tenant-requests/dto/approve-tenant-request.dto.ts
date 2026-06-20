import {
  IsEnum,
  IsInt,
  IsArray,
  IsString,
  IsOptional,
  IsDateString,
  Min,
  Max,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TenantPlan, TenantType } from '@onemdr/database';

export const LICENSE_MODULES = [
  'SIEM',
  'HUNT',
  'COVERAGE',
  'DETECTIONS',
  'REPORTS',
  'AUTOMATIONS',
] as const;

export class ApproveTenantRequestDto {
  @ApiProperty({ enum: TenantPlan, example: 'PRO' })
  @IsEnum(TenantPlan)
  planType!: TenantPlan;

  @ApiProperty({ example: 25, description: 'Maximum number of users allowed' })
  @IsInt()
  @Min(1)
  @Max(10000)
  maxUsers!: number;

  @ApiProperty({
    type: [String],
    example: ['SIEM', 'HUNT', 'DETECTIONS'],
    description: 'Enabled product modules',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  licenseModules!: string[];

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  licenseExpiresAt?: string;

  @ApiPropertyOptional({
    enum: TenantType,
    default: 'STANDARD',
    description: 'STANDARD = single-tenant customer; MSSP = can create child tenants',
  })
  @IsOptional()
  @IsEnum(TenantType)
  tenantType?: TenantType;

  @ApiPropertyOptional({
    example: 10,
    description: 'Max child tenants allowed (MSSP only). Null = unlimited.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxSubTenants?: number;

  @ApiPropertyOptional({ description: 'Internal notes for this approval' })
  @IsOptional()
  @IsString()
  adminNotes?: string;
}

export class RejectTenantRequestDto {
  @ApiProperty({ description: 'Reason shown to the applicant' })
  @IsString()
  rejectionReason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adminNotes?: string;
}
