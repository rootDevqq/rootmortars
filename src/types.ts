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
}

export interface Charge {
  level: number;
  minRange: number;
  maxRange: number;
  rangeTable: RangeTableEntry[];
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
  azimuthMils: number;
  chargeLevel?: number;
  elevation?: number;           // mortar single angle
  elevationLow?: number;        // howitzer low
  elevationHigh?: number;       // howitzer high
  tof?: number;
  status: 'ok' | 'out_of_range' | 'no_data';
  message?: string;
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
