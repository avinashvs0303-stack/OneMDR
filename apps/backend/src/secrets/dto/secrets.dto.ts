import { IsString, IsOptional, IsInt, Min, Max, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateSecretDto {
  // Gap 1 fix: hard cap prevents payload-based DoS.
  // Encryption + DB storage are bounded; 10k chars ≈ 40 KB encrypted blob.
  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  content!: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  label?: string;

  @IsString()
  @IsOptional()
  @MaxLength(128)
  passphrase?: string;

  /** TTL in seconds: 3600=1h, 43200=12h, 86400=24h, 259200=3d, 604800=7d */
  @IsInt()
  @Min(3600)
  @Max(604800)
  @IsOptional()
  ttlSeconds?: number;
}

export class ViewSecretDto {
  @IsString()
  @IsOptional()
  @MaxLength(128)
  passphrase?: string;
}
