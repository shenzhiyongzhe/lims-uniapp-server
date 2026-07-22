import { IsObject } from 'class-validator';

export class UpsertStaffConfigDto {
  @IsObject()
  value!: Record<string, unknown>;
}
