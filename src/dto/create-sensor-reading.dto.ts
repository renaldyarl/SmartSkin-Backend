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

export class SensorReadingItemDto {
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
}

export class CreateSensorReadingDto {
  @IsString()
  @IsNotEmpty()
  location: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SensorReadingItemDto)
  readings: SensorReadingItemDto[];
}
