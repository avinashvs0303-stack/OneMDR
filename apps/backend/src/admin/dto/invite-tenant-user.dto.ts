import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@onemdr/database';

export class InviteTenantUserDto {
  @ApiProperty({ example: 'jane.smith@acme.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Jane Smith' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({ enum: ['ADMIN', 'MEMBER', 'GUEST'], default: 'MEMBER' })
  @IsOptional()
  @IsEnum(['ADMIN', 'MEMBER', 'GUEST'] as const)
  role?: Extract<UserRole, 'ADMIN' | 'MEMBER' | 'GUEST'>;
}
