import {
  IsEnum,
  IsInt,
  IsArray,
  IsString,
  IsOptional,
  IsDateString,
  IsEmail,
  Min,
  Max,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TenantPlan, TenantType } from '@onemdr/database';

export class CreateTenantDto {
  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  companyName!: string;

  @ApiProperty({ example: 'John Smith' })
  @IsString()
  contactName!: string;

  @ApiProperty({ example: 'john@acme.com' })
  @IsEmail()
  contactEmail!: string;

  @ApiProperty({ enum: TenantPlan, example: 'PRO' })
  @IsEnum(TenantPlan)
  planType!: TenantPlan;

  @ApiPropertyOptional({
    enum: TenantType,
    default: 'STANDARD',
    description: 'STANDARD = single-tenant; MSSP = can create child tenants',
  })
  @IsOptional()
  @IsEnum(TenantType)
  tenantType?: TenantType;

  @ApiProperty({ example: 25, description: 'Maximum number of users allowed' })
  @IsInt()
  @Min(1)
  @Max(10000)
  maxUsers!: number;

  @ApiProperty({ type: [String], example: ['DETECTIONS', 'COVERAGE'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  licenseModules!: string[];

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  licenseExpiresAt?: string;

  @ApiPropertyOptional({ example: 10, description: 'Max child tenants (MSSP only)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxSubTenants?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adminNotes?: string;
}
