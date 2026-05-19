// Order MUST match seeder.service.ts (locations: lines 29-32, sensorTypes: lines 43-49).
// Source of truth for the LoRa Format C wire protocol. Re-ordering or renaming
// any entry here is a breaking change for firmware/TTS decoders.

export const LOCATION_BY_ID: Readonly<Record<number, string>> = {
  1: 'right_arm',
  2: 'left_arm',
  3: 'back',
  4: 'right_leg',
  5: 'left_leg',
  6: 'right_elbow',
  7: 'left_elbow',
  8: 'right_knee',
  9: 'left_knee',
};

export const SENSOR_TYPE_BY_ID: Readonly<Record<number, string>> = {
  1: 'temperature',
  2: 'pressure',
  3: 'vibration',
  4: 'flex',
  5: 'strain',
};

export const MAX_POINTS_BY_LOCATION_ID: Readonly<Record<number, number>> = {
  1: 2,
  2: 2,
  3: 4,
  4: 3,
  5: 3,
  6: 1,
  7: 1,
  8: 1,
  9: 1,
};

// Group A (sensors with temperature/pressure/vibration triplet)
export const GROUP_A_LOCATION_IDS: ReadonlySet<number> = new Set([1, 2, 3, 4, 5]);
export const GROUP_A_TYPE_IDS: ReadonlySet<number> = new Set([1, 2, 3]);

// Group B (joint sensors with flex/strain pair)
export const GROUP_B_LOCATION_IDS: ReadonlySet<number> = new Set([6, 7, 8, 9]);
export const GROUP_B_TYPE_IDS: ReadonlySet<number> = new Set([4, 5]);
