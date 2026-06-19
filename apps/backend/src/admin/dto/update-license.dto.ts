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
import { TenantPlan } from '@onemdr/database';

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adminNotes?: string;
}
