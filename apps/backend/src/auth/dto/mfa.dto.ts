import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class VerifyMfaDto {
  @ApiProperty({ example: '123456', description: '6-digit TOTP code from authenticator app' })
  @IsString()
  @Length(6, 6, { message: 'TOTP code must be exactly 6 digits' })
  code: string;
}

export class EnableMfaDto extends VerifyMfaDto {}
export class DisableMfaDto extends VerifyMfaDto {}

export class MfaChallengeDto {
  @ApiProperty({ description: 'Temporary token returned when login requires MFA verification' })
  @IsString()
  mfaToken: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  code: string;
}

export class UseBackupCodeDto {
  @ApiProperty({ description: 'One-time 8-char backup code (shown during MFA setup)' })
  @IsString()
  @Length(8, 8)
  backupCode: string;
}
