import { IsEnum, IsOptional, IsString, IsEmail } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SupportCaseStatus, SupportCasePriority } from '@onemdr/database';

export class UpdateSupportCaseDto {
  @ApiPropertyOptional({ enum: SupportCaseStatus })
  @IsOptional()
  @IsEnum(SupportCaseStatus)
  status?: SupportCaseStatus;

  @ApiPropertyOptional({ enum: SupportCasePriority })
  @IsOptional()
  @IsEnum(SupportCasePriority)
  priority?: SupportCasePriority;

  @ApiPropertyOptional({ description: 'Assign to a Clarbit staff email' })
  @IsOptional()
  @IsEmail()
  assignedToEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  internalNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resolutionNotes?: string;
}

export class CreateSupportCaseDto {
  @ApiPropertyOptional({ description: 'Tenant to file the case under' })
  @IsString()
  tenantId!: string;

  @IsString()
  title!: string;

  @IsString()
  description!: string;

  @ApiPropertyOptional({ enum: SupportCasePriority })
  @IsOptional()
  @IsEnum(SupportCasePriority)
  priority?: SupportCasePriority;

  @IsEmail()
  submittedByEmail!: string;

  @IsString()
  submittedByName!: string;
}
