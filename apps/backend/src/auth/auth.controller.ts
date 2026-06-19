import { Controller, Post, Get, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { EnableMfaDto, DisableMfaDto, MfaChallengeDto } from './dto/mfa.dto';
import type { JwtPayload } from './interfaces/jwt-payload.interface';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── Me (current user from JWT claims + DB lookup) ───────────────────────────

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Return current user profile (verified JWT + DB lookup)' })
  async me(@CurrentUser() user: JwtPayload) {
    const profile = await this.authService.getMe(user);
    return { data: profile ?? user };
  }

  // ── MFA: Setup + Enable + Disable ───────────────────────────────────────────
  // Auth is handled by Supabase. MFA is an additional layer verified by Railway.

  @Post('mfa/setup')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Generate TOTP secret + QR code. Returns backup codes once.' })
  async setupMfa(@CurrentUser() user: JwtPayload) {
    const { qrDataUrl, backupCodes } = await this.authService.setupMfa(user.sub);
    return { data: { qrDataUrl, backupCodes } };
  }

  @Post('mfa/enable')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Confirm MFA setup by verifying first TOTP code' })
  async enableMfa(@CurrentUser() user: JwtPayload, @Body() dto: EnableMfaDto) {
    await this.authService.enableMfa(user.sub, dto.code);
  }

  @Post('mfa/disable')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Disable MFA after verifying current TOTP code' })
  async disableMfa(@CurrentUser() user: JwtPayload, @Body() dto: DisableMfaDto) {
    await this.authService.disableMfa(user.sub, dto.code);
  }

  // ── MFA: Challenge + Verify (called after Supabase login when mfaEnabled=true) ──

  @Public()
  @Post('mfa/challenge')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Issue a short-lived MFA bridge token after Supabase login' })
  async mfaChallenge(@Body() body: { userId: string }) {
    const mfaToken = this.authService.issueMfaBridgeToken(body.userId);
    return { data: { mfaToken } };
  }

  @Public()
  @Post('mfa/verify')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify TOTP code and confirm MFA challenge' })
  async mfaVerify(@Body() dto: MfaChallengeDto) {
    const result = await this.authService.completeMfaChallenge(dto.mfaToken, dto.code);
    return { data: result };
  }
}
