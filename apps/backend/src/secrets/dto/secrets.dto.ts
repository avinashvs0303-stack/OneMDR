import { IsString, IsOptional, IsInt, Min, Max, IsNotEmpty } from 'class-validator';

export class CreateSecretDto {
  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsString()
  @IsOptional()
  label?: string;

  @IsString()
  @IsOptional()
  passphrase?: string;

  /** TTL in seconds. 3600=1h, 43200=12h, 86400=24h, 259200=3d, 604800=7d */
  @IsInt()
  @Min(3600)
  @Max(604800)
  @IsOptional()
  ttlSeconds?: number;
}

export class ViewSecretDto {
  @IsString()
  @IsOptional()
  passphrase?: string;
}
