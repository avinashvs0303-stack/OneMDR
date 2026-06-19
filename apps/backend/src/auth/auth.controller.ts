import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBody,
} from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { EnableMfaDto, DisableMfaDto, MfaChallengeDto } from './dto/mfa.dto';
import type { JwtPayload } from './interfaces/jwt-payload.interface';
import type { User } from '@onemdr/database';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
  ) {}

  // ── Register ────────────────────────────────────────────────────────────────

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({
    description: 'Account created. Access token returned; refresh token set in cookie.',
  })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const meta = this.extractMeta(req);
    const { accessToken, rawRefreshToken, user } = await this.authService.register(dto, meta);

    void res.setCookie(
      this.tokenService.cookieName,
      rawRefreshToken,
      this.tokenService.buildCookieOptions(false),
    );

    return { data: { accessToken, user } };
  }

  // ── Login ───────────────────────────────────────────────────────────────────

  @Public()
  @Post('login')
  @UseGuards(LocalAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ description: 'Authenticated. May return MFA challenge.' })
  async login(
    @Req() req: FastifyRequest & { user: User; body: LoginDto },
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const meta = { ...this.extractMeta(req), rememberMe: req.body.rememberMe };
    const result = await this.authService.login(req.user, meta);

    if ('requiresMfa' in result) {
      return { data: { requiresMfa: true, mfaToken: result.mfaToken } };
    }

    void res.setCookie(
      this.tokenService.cookieName,
      result.rawRefreshToken,
      this.tokenService.buildCookieOptions(meta.rememberMe),
    );

    return { data: { accessToken: result.accessToken, user: result.user } };
  }

  // ── MFA challenge (complete login when MFA is enabled) ──────────────────────

  @Public()
  @Post('mfa/verify-login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'MFA verified. Full session issued.' })
  async verifyMfaLogin(
    @Body() dto: MfaChallengeDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const meta = this.extractMeta(req);
    const { accessToken, rawRefreshToken, user } = await this.authService.loginWithMfa(
      dto.mfaToken,
      dto.code,
      meta,
    );

    void res.setCookie(
      this.tokenService.cookieName,
      rawRefreshToken,
      this.tokenService.buildCookieOptions(),
    );

    return { data: { accessToken, user } };
  }

  // ── Refresh ──────────────────────────────────────────────────────────────────

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'New access token + rotated refresh token cookie.' })
  async refresh(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const rawRefreshToken = (req.cookies as Record<string, string | undefined>)[
      this.tokenService.cookieName
    ];
    if (!rawRefreshToken) {
      return res.status(HttpStatus.UNAUTHORIZED).send({
        error: { code: 'NO_REFRESH_TOKEN', message: 'No refresh token', statusCode: 401 },
      });
    }

    const meta = this.extractMeta(req);
    const { accessToken, rawRefreshToken: newRaw } = await this.authService.refresh(
      rawRefreshToken,
      meta,
    );

    void res.setCookie(
      this.tokenService.cookieName,
      newRaw,
      this.tokenService.buildCookieOptions(),
    );

    return { data: { accessToken } };
  }

  // ── Logout ───────────────────────────────────────────────────────────────────

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke refresh token and clear session cookie (no auth required)' })
  async logout(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const raw = (req.cookies as Record<string, string | undefined>)[this.tokenService.cookieName];

    // Revoke best-effort — cookie is cleared regardless of token state
    if (raw) {
      await this.authService.logoutByRefreshToken(raw, this.extractMeta(req));
    }

    // ALWAYS clear the cookie so the middleware stops granting access
    void res.setCookie(this.tokenService.cookieName, '', this.tokenService.clearCookieOptions());
  }

  // ── MFA: Setup + Enable + Disable ───────────────────────────────────────────

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

  // ── Google OAuth ─────────────────────────────────────────────────────────────

  @Public()
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Redirect to Google OAuth consent screen' })
  async googleLogin() {
    // GoogleAuthGuard handles the redirect
  }

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleCallback(
    @Req() req: FastifyRequest & { user: User },
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const meta = this.extractMeta(req);
    const result = await this.authService.login(req.user, meta);

    if ('requiresMfa' in result) {
      // Google users with MFA enabled → redirect to MFA page with token
      void res.redirect(`${process.env['FRONTEND_URL']}/auth/mfa?mfaToken=${result.mfaToken}`);
      return;
    }

    void res.setCookie(
      this.tokenService.cookieName,
      result.rawRefreshToken,
      this.tokenService.buildCookieOptions(),
    );

    // Pass access token via URL hash so frontend can pick it up
    void res.redirect(`${process.env['FRONTEND_URL']}/auth/callback?token=${result.accessToken}`);
  }

  // ── Me (current user) ────────────────────────────────────────────────────────

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Return current authenticated user from JWT payload' })
  async me(@CurrentUser() user: JwtPayload) {
    return { data: user };
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private extractMeta(req: FastifyRequest) {
    return {
      ip: (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip,
      device: req.headers['user-agent'],
    };
  }
}
