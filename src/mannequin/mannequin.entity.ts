import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Sensor } from '../sensor/sensor.entity';

@Entity()
export class Mannequin {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @OneToMany(() => Sensor, (sensor) => sensor.mannequin)
  sensors: Sensor[];
}
