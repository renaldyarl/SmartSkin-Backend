import { IsOptional, IsInt, Min, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export enum SensorTypeEnum {
  TEMPERATURE = 'temperature',
  PRESSURE = 'pressure',
  VIBRATION = 'vibration',
}

export class PaginateSensorReadingQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  sensorType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sensorNumber?: number;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  mannequin_id?: number = 1;
}
