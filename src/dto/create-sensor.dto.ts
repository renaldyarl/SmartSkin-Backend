import { IsInt, IsString, IsNotEmpty } from 'class-validator';

export class CreateSensorDto {
  @IsInt()
  @IsNotEmpty()
  externalId: number;

  @IsInt()
  @IsNotEmpty()
  sensorTypeId: number;

  @IsInt()
  @IsNotEmpty()
  locationId: number;
}