import { IsOptional, IsString } from 'class-validator';

export class CreateErrorLogDto {
  @IsOptional()
  @IsString()
  level?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsString()
  message!: string;

  @IsOptional()
  @IsString()
  stack?: string;

  @IsOptional()
  @IsString()
  pageRoute?: string;

  @IsOptional()
  deviceInfo?: any;
}
