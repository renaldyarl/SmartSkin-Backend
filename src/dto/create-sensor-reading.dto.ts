// src/sensor-reading/dto/create-sensor-reading.dto.ts
import { IsString, IsNumber, IsNotEmpty } from 'class-validator';

export class CreateSensorReadingDto {
  @IsString()
  @IsNotEmpty()
  location: string;

  @IsString()
  @IsNotEmpty()
  sensorType: string;

  @IsNumber()
  @IsNotEmpty()
  value: number;
}