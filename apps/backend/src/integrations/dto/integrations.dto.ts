import { IsString, IsEnum, IsBoolean, IsOptional, IsObject, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type IntegrationPlatform =
  | 'SPLUNK'
  | 'SENTINEL'
  | 'CHRONICLE'
  | 'ELASTIC'
  | 'QRADAR'
  | 'DEFENDER'
  | 'SIGMA'
  | 'CUSTOM';

export class CreateIntegrationDto {
  @ApiProperty({
    enum: ['SPLUNK', 'SENTINEL', 'CHRONICLE', 'ELASTIC', 'QRADAR', 'DEFENDER', 'SIGMA', 'CUSTOM'],
  })
  @IsEnum(['SPLUNK', 'SENTINEL', 'CHRONICLE', 'ELASTIC', 'QRADAR', 'DEFENDER', 'SIGMA', 'CUSTOM'])
  platform!: IntegrationPlatform;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty()
  @IsString()
  host!: string;

  @ApiPropertyOptional({ description: 'Platform-specific credentials & settings as JSON' })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class UpdateIntegrationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  host?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}
