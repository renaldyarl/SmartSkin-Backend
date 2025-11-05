import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('sensor_readings')
export class SensorReading {
  @PrimaryGeneratedColumn()
  sensor_id: number;

  @Column()
  id: number;

  @Column('double precision')
  value: number;

  @CreateDateColumn()
  timestamp: Date;
}
