import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Sensor } from '../sensor/sensor.entity';

@Entity()
export class SensorReading {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Sensor, (sensor) => sensor.readings)
  @JoinColumn({ name: 'sensor_id' })
  sensor: Sensor;

  @Column('numeric', { precision: 10, scale: 4 })
  value: number;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;
}
