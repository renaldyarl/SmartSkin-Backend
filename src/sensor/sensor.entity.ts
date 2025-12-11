import { 
  Entity, 
  PrimaryGeneratedColumn, 
  ManyToOne, 
  OneToMany, 
  JoinColumn 
} from "typeorm";

import { SensorType } from "./sensor-type.entity";
import { Location } from "./location.entity";
import { SensorReading } from "../sensor-reading/sensor-reading.entity";

@Entity('sensor')
export class Sensor {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => SensorType, (sensorType) => sensorType.sensors)
  @JoinColumn({ name: 'sensor_type_id' })   // FIXED
  sensorType: SensorType;

  @ManyToOne(() => Location, (location) => location.sensors)
  @JoinColumn({ name: 'location_id' })     
  location: Location;

  @OneToMany(() => SensorReading, (reading) => reading.sensor)
  readings: SensorReading[];
}
