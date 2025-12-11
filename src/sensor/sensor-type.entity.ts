import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";
import { Sensor } from "./sensor.entity";

@Entity()
export class SensorType {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  unit: string;

  @OneToMany(() => Sensor, (sensor) => sensor.sensorType)
  sensors: Sensor[];
}
