import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  IsArray,
  MaxLength,
} from 'class-validator';

export class UpdateArchiveDto {
  @IsString()
  @IsOptional()
  @MaxLength(128)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(32)
  phone?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  amount?: number;

  @IsString()
  @IsOptional()
  @MaxLength(256)
  address?: string;

  @IsString()
  @IsOptional()
  @MaxLength(128)
  job?: string;

  @IsString()
  @IsOptional()
  @MaxLength(128)
  income?: string;

  @IsString()
  @IsOptional()
  date?: string;

  @IsString()
  @IsOptional()
  @MaxLength(128)
  account?: string;

  @IsString()
  @IsOptional()
  @MaxLength(128)
  password?: string;

  @IsString()
  @IsOptional()
  situation?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  detail?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  photos?: string[];
}
