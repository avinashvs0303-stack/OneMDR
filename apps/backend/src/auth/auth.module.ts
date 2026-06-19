import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // JwtModule is still used for MFA bridge tokens (short-lived, internal use only).
    // All user-facing auth tokens are issued and managed by Supabase.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // MFA bridge tokens use the same Supabase JWT secret for consistency
        secret: config.getOrThrow<string>('SUPABASE_JWT_SECRET'),
        signOptions: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          expiresIn: '10m' as any,
          issuer: 'onemdr-mfa',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
