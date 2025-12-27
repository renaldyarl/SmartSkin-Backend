import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Location } from '../location/location.entity';
import { SensorType } from '../sensor/sensor-type.entity';
import { SensorReading } from '../sensor-reading/sensor-reading.entity';

@Entity()
export class Sensor {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  externalId: number; 

  @ManyToOne(() => SensorType, (type) => type.sensors)
  @JoinColumn({ name: 'sensor_type_id' })
  sensorType: SensorType;

  @ManyToOne(() => Location, (location) => location.sensors)
  @JoinColumn({ name: 'location_id' })
  location: Location;

  // Relasi ke pembacaan
  @OneToMany(() => SensorReading, (reading) => reading.sensor)
  readings: SensorReading[];
}