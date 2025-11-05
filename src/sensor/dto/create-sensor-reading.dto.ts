import {IsNumber } from 'class-validator';

export class CreateSensorReadingDto {
  @IsNumber()
  sensor_id: number;

  @IsNumber()
  value: number;
}
