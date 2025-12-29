import { IsString, IsNumber, IsNotEmpty, Min, Max } from 'class-validator';

export class CreateSensorReadingDto {
  @IsString()
  @IsNotEmpty()
  location: string;

  @IsString()
  @IsNotEmpty()
  sensorType: string;

  @IsNumber()
  @Min(1)
  @Max(2)
  sensorNumber: number;

  @IsNumber()
  @IsNotEmpty()
  value: number;
}