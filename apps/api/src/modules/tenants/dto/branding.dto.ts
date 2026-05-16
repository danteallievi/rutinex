import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class BrandingDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  primaryColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  accentColor?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(2048)
  logoUrl?: string;
}
