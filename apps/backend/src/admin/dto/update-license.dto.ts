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

export class UpdateLicenseDto {
  @ApiProperty({ enum: TenantPlan })
  @IsEnum(TenantPlan)
  planType!: TenantPlan;

  @ApiProperty({ example: 50 })
  @IsInt()
  @Min(1)
  @Max(10000)
  maxUsers!: number;

  @ApiProperty({ type: [String], example: ['SIEM', 'HUNT'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  licenseModules!: string[];

  @ApiPropertyOptional({ example: '2027-12-31T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  licenseExpiresAt?: string;

  @ApiPropertyOptional({ enum: TenantType, default: 'STANDARD' })
  @IsOptional()
  @IsEnum(TenantType)
  tenantType?: TenantType;

  @ApiPropertyOptional({
    example: 10,
    description: 'Max child tenants (MSSP only). Null = unlimited.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxSubTenants?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adminNotes?: string;
}
