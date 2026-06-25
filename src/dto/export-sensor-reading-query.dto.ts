import { IsOptional, IsString, IsInt, Min, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class ExportSensorReadingQueryDto {
  // Single day to export, format YYYY-MM-DD
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be in YYYY-MM-DD format',
  })
  date: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  mannequin_id?: number = 1;

  @IsOptional()
  @IsString()
  sensorType?: string;

  @IsOptional()
  @IsString()
  location?: string;
}
