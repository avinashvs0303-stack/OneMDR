import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsOptional, IsBoolean } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'alice@acme.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Super$ecure123!' })
  @IsString()
  password: string;

  @ApiProperty({ required: false, description: 'Extend refresh token TTL to 30 days' })
  @IsBoolean()
  @IsOptional()
  rememberMe?: boolean;
}
