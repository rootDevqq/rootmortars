import type {
  WeaponSystem,
  Position,
  FireSolution,
  MortarMode,
  HowitzerAmmoGroup,
  ProjectileType,
  Charge,
  RangeTableEntry,
} from '../types';

// ─── KEY FIX: milsPerCircle may be nested in milSystem ───────────────────────

export function getMilsPerCircle(w: WeaponSystem): number {
  return w.milsPerCircle ?? w.milSystem?.milsPerCircle ?? 6400;
}

// ─── Azimuth (Arma convention: atan2(dX, dY)) ────────────────────────────────

export function calcAzimuthMils(
  gx: number, gy: number,
  tx: number, ty: number,
  milsPerCircle: number,
): number {
  const dx = tx - gx;
  const dy = ty - gy;
  let deg = Math.atan2(dx, dy) * (180 / Math.PI);
  if (deg < 0) deg += 360;
  return Math.round(deg * milsPerCircle / 360) % milsPerCircle;
}

// ─── Linear interpolation in range table (handles null tof) ──────────────────

function interpolateTable(
  table: RangeTableEntry[],
  range: number,
): { elevation: number; tof: number | null; dElev: number } | null {
  if (!table || table.length === 0) return null;
  const sorted = [...table].sort((a, b) => a.range - b.range);

  if (range <= sorted[0].range) {
    const e = sorted[0];
    return { elevation: e.elevation, tof: e.tof ?? null, dElev: e.dElev ?? 0 };
  }
  if (range >= sorted[sorted.length - 1].range) {
    const e = sorted[sorted.length - 1];
    return { elevation: e.elevation, tof: e.tof ?? null, dElev: e.dElev ?? 0 };
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const lo = sorted[i];
    const hi = sorted[i + 1];
    if (lo.range <= range && range <= hi.range) {
      const t = (range - lo.range) / (hi.range - lo.range);
      const tofLo = lo.tof ?? 0;
      const tofHi = hi.tof ?? 0;
      return {
        elevation: Math.round(lo.elevation + t * (hi.elevation - lo.elevation)),
        tof: (lo.tof !== null && hi.tof !== null) ? tofLo + t * (tofHi - tofLo) : null,
        dElev: (lo.dElev ?? 0) + t * ((hi.dElev ?? 0) - (lo.dElev ?? 0)),
      };
    }
  }
  return null;
}

// ─── Pick best mortar charge for range ───────────────────────────────────────

function pickBestCharge(charges: Charge[], range: number): Charge | null {
  const valid = charges.filter(c => range >= c.minRange && range <= c.maxRange);
  if (valid.length === 0) return null;
  return valid.sort((a, b) => a.maxRange - b.maxRange)[0];
}

// ─── KEY FIX: strip "Low Angle" / "High Angle" suffix to group howitzer ammo ─

export function getHowitzerAmmoGroups(weapon: WeaponSystem): HowitzerAmmoGroup[] {
  if (!weapon.projectileTypes) return [];
  const map = new Map<string, HowitzerAmmoGroup>();

  for (const pt of weapon.projectileTypes) {
    const key = pt.name
      .replace(/\s+(low|high)\s+angle\s*$/i, '')
      .replace(/\s+(low|high)\s*$/i, '')
      .trim();
    if (!map.has(key)) map.set(key, { id: key, name: key });
    const g = map.get(key)!;
    if (pt.variant === 'low_angle') g.lowAngle = pt;
    else g.highAngle = pt;
  }

  return Array.from(map.values());
}

// ─── Main fire solution calculator ───────────────────────────────────────────

export function calculateFireSolution(
  weapon: WeaponSystem,
  ammoId: string,
  mode: MortarMode,
  gunPos: Position,
  targetPos: Position,
): FireSolution | null {
  const gx = Number(gunPos.x), gy = Number(gunPos.y), gh = Number(gunPos.h);
  const tx = Number(targetPos.x), ty = Number(targetPos.y), th = Number(targetPos.h);
  if ([gx, gy, gh, tx, ty, th].some(isNaN)) return null;

  const dx = tx - gx, dy = ty - gy;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const mils = getMilsPerCircle(weapon);
  const azimuthMils = calcAzimuthMils(gx, gy, tx, ty, mils);

  // ── Mortar ──────────────────────────────────────────────────────────────────
  if (weapon.systemType === 'mortar') {
    const ammo = weapon.ammo?.find(a => a.id === ammoId);
    if (!ammo) return { distance, azimuthMils, status: 'no_data', message: 'Снаряд не найден' };

    const modeData =
      mode === 'adult_mortars' && ammo.modes.adult_mortars
        ? ammo.modes.adult_mortars
        : ammo.modes.original;

    if (!modeData?.charges?.length)
      return { distance, azimuthMils, status: 'no_data', message: 'Нет данных' };

    const charge = pickBestCharge(modeData.charges, distance);
    if (!charge) {
      const minR = Math.min(...modeData.charges.map(c => c.minRange));
      const maxR = Math.max(...modeData.charges.map(c => c.maxRange));
      return {
        distance, azimuthMils, status: 'out_of_range',
        message: `Вне зоны • ${Math.round(distance)} м (диап. ${minR}–${maxR})`,
      };
    }

    const interp = interpolateTable(charge.rangeTable, distance);
    if (!interp) return { distance, azimuthMils, status: 'no_data', message: 'Ошибка интерполяции' };

    let elevation = interp.elevation;
    if (weapon.usesHeightCorrection) {
      elevation = Math.round(elevation + (interp.dElev ?? 0) * (th - gh) / 100);
    }

    return {
      distance,
      azimuthMils,
      chargeLevel: charge.level,
      elevation,
      tof: interp.tof ?? undefined,
      status: 'ok',
    };
  }

  // ── Howitzer / MLRS ─────────────────────────────────────────────────────────
  if (weapon.systemType === 'howitzer' || weapon.systemType === 'mlrs') {
    const group = getHowitzerAmmoGroups(weapon).find(g => g.id === ammoId);
    if (!group) return { distance, azimuthMils, status: 'no_data', message: 'Снаряд не найден' };

    const interpPt = (pt?: ProjectileType) => {
      if (!pt) return undefined;
      if (distance < pt.minRange || distance > pt.maxRange) return undefined;
      return interpolateTable(pt.ballisticTable, distance);
    };

    const low  = interpPt(group.lowAngle);
    const high = interpPt(group.highAngle);

    if (!low && !high) {
      const pts = [group.lowAngle, group.highAngle].filter(Boolean) as ProjectileType[];
      const minR = Math.min(...pts.map(pt => pt.minRange));
      const maxR = Math.max(...pts.map(pt => pt.maxRange));
      return {
        distance, azimuthMils, status: 'out_of_range',
        message: `Вне зоны • ${Math.round(distance)} м (диап. ${minR}–${maxR})`,
      };
    }

    return {
      distance,
      azimuthMils,
      elevationLow:  low  ? low.elevation  : undefined,
      elevationHigh: high ? high.elevation : undefined,
      tof: low?.tof ?? high?.tof ?? undefined,
      status: 'ok',
    };
  }

  return { distance, azimuthMils, status: 'no_data', message: 'Неизвестный тип орудия' };
}

// ─── Numpad offset: shift target in numpad direction ─────────────────────────
// X=East, Y=North. Numpad: 7=NW, 8=N, 9=NE, 4=W, 5=center, 6=E, 1=SW, 2=S, 3=SE

export function numpadOffset(
  x: number, y: number,
  key: number, step: number,
): { x: number; y: number } {
  const offsets: Record<number, [number, number]> = {
    7: [-1, +1], 8: [0, +1], 9: [+1, +1],
    4: [-1,  0], 5: [0,  0], 6: [+1,  0],
    1: [-1, -1], 2: [0, -1], 3: [+1, -1],
  };
  const [ddx, ddy] = offsets[key] ?? [0, 0];
  return { x: x + ddx * step, y: y + ddy * step };
}

// ─── Apply fire correction ────────────────────────────────────────────────────
// rangeDelta: positive=further, negative=closer
// azDeltaMils: positive=right, negative=left

export function applyCorrection(
  gx: number, gy: number,
  tx: number, ty: number,
  rangeDelta: number,
  azDeltaMils: number,
  milsPerCircle: number,
): { x: number; y: number } {
  const dx = tx - gx, dy = ty - gy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return { x: tx, y: ty };

  const ux = dx / dist, uy = dy / dist;
  // Perpendicular right-of-direction: rotate 90° clockwise
  const rx = uy, ry = -ux;

  const azRad = azDeltaMils * (2 * Math.PI) / milsPerCircle;
  const lateralDist = dist * azRad;

  const newX = tx + ux * rangeDelta + rx * lateralDist;
  const newY = ty + uy * rangeDelta + ry * lateralDist;
  return { x: Math.round(newX), y: Math.round(newY) };
}

// ─── Format helpers ───────────────────────────────────────────────────────────

export function formatMils(v: number | undefined, milsPerCircle: number): string {
  if (v === undefined) return '—';
  const m = ((Math.round(v) % milsPerCircle) + milsPerCircle) % milsPerCircle;
  return m.toString().padStart(4, '0');
}

export function formatDist(d: number): string {
  return `${Math.round(d)} м`;
}

export function formatTof(s: number | null | undefined): string {
  if (s == null) return '—';
  return `${s.toFixed(1)} с`;
}
