import { IsOptional, IsString } from 'class-validator';

export class QueryErrorLogDto {
  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  pageSize?: string;
}
