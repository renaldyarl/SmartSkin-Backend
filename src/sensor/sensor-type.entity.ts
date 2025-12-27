import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Sensor } from '../sensor/sensor.entity';

@Entity()
export class SensorType {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50 })
  name: string;

  @Column({ length: 20 })
  unit: string;

  @OneToMany(() => Sensor, (sensor) => sensor.sensorType)
  sensors: Sensor[];
}