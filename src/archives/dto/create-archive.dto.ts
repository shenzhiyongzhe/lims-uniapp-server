import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  IsArray,
  MaxLength,
} from 'class-validator';

export class CreateArchiveDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(32)
  phone?: string;

  @IsInt()
  @Min(0)
  amount: number;

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
  date?: string; // Expecting YYYY-MM-DD or date string

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
  @MaxLength(2000)
  detail?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  photos?: string[];
}
