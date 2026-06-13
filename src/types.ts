export interface MilSystem {
  name: string;
  milsPerCircle: number;
  milsPerDegree: number;
}

export interface RangeTableEntry {
  range: number;
  elevation: number;
  tof: number | null;
  dElev?: number | null;
  windCross?: number | null;
  windLong?: number | null;
}

export interface Charge {
  level: number;
  minRange: number;
  maxRange: number;
  rangeTable: RangeTableEntry[];
  dispersion?: number;
}

export interface MortarAmmoMode { charges: Charge[]; }

export interface MortarAmmo {
  id: string;
  name: string;
  type: string;
  modes: { original: MortarAmmoMode; adult_mortars?: MortarAmmoMode; };
}

export interface ProjectileType {
  id: string;
  name: string;
  type: string;
  variant: 'low_angle' | 'high_angle';
  charge?: number;          // howitzers with multiple powder charges (e.g. M777)
  dispersion?: number;      // m, average dispersion for this table
  minRange: number;
  maxRange: number;
  ballisticTable: RangeTableEntry[];
}

export interface WeaponSystem {
  id: string;
  name: string;
  caliber: number;
  systemType: 'mortar' | 'howitzer' | 'mlrs';
  milsPerCircle?: number;      // mortars
  milSystem?: MilSystem;       // howitzers / mlrs
  usesHeightCorrection?: boolean;
  hasCharges?: boolean;        // howitzer with selectable powder charges (M777)
  ammo?: MortarAmmo[];
  projectileTypes?: ProjectileType[];
}

// One powder-charge level for a howitzer shell (e.g. M777 Charge 1..5),
// each carrying its own low-angle / high-angle ballistic table.
export interface HowitzerCharge {
  charge: number;
  minRange: number;       // union of low+high envelopes
  maxRange: number;
  lowAngle?: ProjectileType;
  highAngle?: ProjectileType;
}

export interface HowitzerAmmoGroup {
  id: string;
  name: string;
  lowAngle?: ProjectileType;       // chargeless weapons (D-30, M119)
  highAngle?: ProjectileType;
  charges?: HowitzerCharge[];      // charge-based weapons (M777)
}

// 'auto' = calculator picks the lowest charge that reaches; otherwise a forced level.
export type HowitzerChargeMode = 'auto' | number;

export interface Position { x: number | ''; y: number | ''; h: number | ''; }
export type MortarMode = 'original' | 'adult_mortars';

export interface FireSolution {
  distance: number;
  azimuthMils: number;          // mortar: wind-corrected. howitzer: base (geometric) bearing
  chargeLevel?: number;
  elevation?: number;           // mortar single angle (wind-corrected range used for lookup)
  elevationLow?: number;        // howitzer low
  elevationHigh?: number;       // howitzer high
  tof?: number;
  // Howitzer per-trajectory results — low and high diverge under wind, since each
  // angle has its own cross/long wind sensitivity (high-angle drifts far more).
  azimuthMilsLow?: number;
  azimuthMilsHigh?: number;
  tofLow?: number;
  tofHigh?: number;
  windAzDeltaLow?: number;
  windAzDeltaHigh?: number;
  windRangeDeltaLow?: number;
  windRangeDeltaHigh?: number;
  status: 'ok' | 'out_of_range' | 'no_data';
  message?: string;
  // Wind correction info (only when wind speed > 0 and wind data available)
  windAzDelta?: number;         // mils added to azimuth (+ = right) — mortar
  windRangeDelta?: number;      // m added to effective range (+ = further) — mortar
  dispersion?: number;          // m dispersion at this charge
}

// ─── Wind database ────────────────────────────────────────────────────────────

export interface WindEntry {
  r: number;   // range m
  wc: number;  // cross correction mils per 10 m/s
  wl: number;  // long correction m per 10 m/s
}

export interface WindCharge {
  ring: number;
  d: number;        // dispersion m
  t: WindEntry[];   // table
}

export interface WindDatabase {
  version: string;
  weapons: {
    [weaponId: string]: {
      [ammoId: string]: WindCharge[];
    };
  };
}

export interface GameMap {
  id: string;
  names: { en: string; ru: string };
  gridSquareMeters: number;
  widthMeters: number | null;
  heightMeters: number | null;
  permanentZones: string[];
}

export interface MapPoint {
  id: string;
  mapId: string;
  location: string;
  label: string;
  x: number;
  y: number;
  h: number;
  note?: string | null;
}

export interface SavedGunPosition {
  id: string;
  name: string;
  mapId: string;
  x: number;
  y: number;
  h: number;
}
