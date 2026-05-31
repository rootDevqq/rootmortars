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
  ammo?: MortarAmmo[];
  projectileTypes?: ProjectileType[];
}

export interface HowitzerAmmoGroup {
  id: string;
  name: string;
  lowAngle?: ProjectileType;
  highAngle?: ProjectileType;
}

export interface Position { x: number | ''; y: number | ''; h: number | ''; }
export type MortarMode = 'original' | 'adult_mortars';

export interface FireSolution {
  distance: number;
  azimuthMils: number;          // wind-corrected if wind active
  chargeLevel?: number;
  elevation?: number;           // mortar single angle (wind-corrected range used for lookup)
  elevationLow?: number;        // howitzer low
  elevationHigh?: number;       // howitzer high
  tof?: number;
  status: 'ok' | 'out_of_range' | 'no_data';
  message?: string;
  // Wind correction info (only when wind speed > 0 and wind data available)
  windAzDelta?: number;         // mils added to azimuth (+ = right)
  windRangeDelta?: number;      // m added to effective range (+ = further)
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
