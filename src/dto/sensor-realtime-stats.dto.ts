export interface SensorRealtimeStats {
  sensorType: string;
  unit: string;
  value: number | null;
  timestamp: Date | null;
}
