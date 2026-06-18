import { IsEmail, IsString, IsOptional, MinLength, MaxLength, IsUrl, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '500+'] as const;

export class SubmitTenantRequestDto {
  @ApiProperty({ example: 'Acme Security' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  companyName!: string;

  @ApiPropertyOptional({ enum: COMPANY_SIZES })
  @IsOptional()
  @IsIn(COMPANY_SIZES)
  companySize?: string;

  @ApiPropertyOptional({ example: 'Financial Services' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string;

  @ApiPropertyOptional({ example: 'https://acme.com' })
  @IsOptional()
  @IsUrl()
  website?: string;

  @ApiProperty({ example: 'Alice Smith' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  contactName!: string;

  @ApiProperty({ example: 'alice@acme.com' })
  @IsEmail()
  contactEmail!: string;

  @ApiPropertyOptional({ example: '+1 555 0100' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  contactPhone?: string;

  @ApiPropertyOptional({ description: 'What will you use OneMDR for?' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  useCase?: string;
}
