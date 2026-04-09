import {
  IsString,
  IsNumber,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BatchSensorReadingItemDto {
  @IsString()
  @IsNotEmpty()
  sensorType: string;

  @IsNumber()
  @Min(1)
  @Max(4)
  sensorNumber: number;

  @IsNumber()
  @IsNotEmpty()
  value: number;

  @IsString()
  @IsNotEmpty()
  location: string;
}

export class BatchCreateSensorReadingDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BatchSensorReadingItemDto)
  readings: BatchSensorReadingItemDto[];
}
