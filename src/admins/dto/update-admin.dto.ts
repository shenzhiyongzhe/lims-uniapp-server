import { ManagementRoles } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAdminDto {
  @IsOptional()
  @IsString()
  @MaxLength(10)
  username?: string;

  @IsOptional()
  @IsEnum(ManagementRoles)
  role?: ManagementRoles;
}
