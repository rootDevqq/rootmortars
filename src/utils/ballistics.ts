import type {
  WeaponSystem,
  Position,
  FireSolution,
  MortarMode,
  HowitzerAmmoGroup,
  HowitzerCharge,
  HowitzerChargeMode,
  ProjectileType,
  Charge,
  RangeTableEntry,
  WindDatabase,
  WindCharge,
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

// ─── KEY FIX: strip "Low/High Angle" (+ "Charge N") suffix to group howitzer ammo ─
//
// D-30 / M119: one shell → one low + one high table.
// M777: one shell → N charges, each with its own low + high table. We strip both
// the angle word and the "Charge N" token so all charges collapse into one group.

export function getHowitzerAmmoGroups(weapon: WeaponSystem): HowitzerAmmoGroup[] {
  if (!weapon.projectileTypes) return [];
  const map = new Map<string, HowitzerAmmoGroup>();

  for (const pt of weapon.projectileTypes) {
    const key = pt.name
      .replace(/\s+(low|high)\s+angle\s*$/i, '')
      .replace(/\s+(low|high)\s*$/i, '')
      .replace(/\s+charge\s+\d+\s*$/i, '')
      .trim();
    if (!map.has(key)) map.set(key, { id: key, name: key });
    const g = map.get(key)!;

    if (pt.charge != null) {
      // Charge-based weapon: route the table into the matching charge entry.
      if (!g.charges) g.charges = [];
      let ch = g.charges.find(c => c.charge === pt.charge);
      if (!ch) {
        ch = { charge: pt.charge, minRange: Infinity, maxRange: -Infinity };
        g.charges.push(ch);
      }
      if (pt.variant === 'low_angle') ch.lowAngle = pt;
      else ch.highAngle = pt;
      ch.minRange = Math.min(ch.minRange, pt.minRange);
      ch.maxRange = Math.max(ch.maxRange, pt.maxRange);
    } else {
      if (pt.variant === 'low_angle') g.lowAngle = pt;
      else g.highAngle = pt;
    }
  }

  for (const g of map.values()) {
    if (g.charges) g.charges.sort((a, b) => a.charge - b.charge);
  }

  return Array.from(map.values());
}

// ─── Pick lowest howitzer charge that can reach the target ───────────────────
// Mirrors the mortar "lowest viable charge" rule: steeper arc, tighter dispersion.

export function pickBestHowitzerCharge(
  charges: HowitzerCharge[],
  range: number,
): HowitzerCharge | null {
  const valid = charges.filter(c => range >= c.minRange && range <= c.maxRange);
  if (valid.length === 0) return null;
  return valid.sort((a, b) => a.charge - b.charge)[0];
}

// ─── Wind correction ──────────────────────────────────────────────────────────
//
// windDir: degrees FROM which wind blows (0=N, 90=E — Arma convention after 1.7.0.41)
// azimuthDeg: shot direction in degrees
// Returns: { azDelta mils, rangeDelta m, dispersion m } or null if no wind data

export interface WindCorrection {
  azDelta: number;      // mils to add to azimuth (+ = right)
  rangeDelta: number;   // m to add to effective range (+ = further/headwind)
  dispersion: number;   // m
}

function interpolateWind(table: WindCharge['t'], distance: number): { wc: number; wl: number } {
  const sorted = [...table].sort((a, b) => a.r - b.r);
  if (!sorted.length) return { wc: 0, wl: 0 };
  if (distance <= sorted[0].r) return { wc: sorted[0].wc, wl: sorted[0].wl };
  const last = sorted[sorted.length - 1];
  if (distance >= last.r) return { wc: last.wc, wl: last.wl };
  for (let i = 0; i < sorted.length - 1; i++) {
    const lo = sorted[i], hi = sorted[i + 1];
    if (lo.r <= distance && distance <= hi.r) {
      const t = (distance - lo.r) / (hi.r - lo.r);
      return {
        wc: lo.wc + t * (hi.wc - lo.wc),
        wl: lo.wl + t * (hi.wl - lo.wl),
      };
    }
  }
  return { wc: 0, wl: 0 };
}

function interpolateWindFromRangeTable(
  table: RangeTableEntry[],
  distance: number,
): { wc: number; wl: number } | null {
  const sorted = [...table].sort((a, b) => a.range - b.range);
  if (!sorted.length) return null;
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (distance <= first.range) {
    return { wc: first.windCross ?? 0, wl: first.windLong ?? 0 };
  }
  if (distance >= last.range) {
    return { wc: last.windCross ?? 0, wl: last.windLong ?? 0 };
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    const lo = sorted[i], hi = sorted[i + 1];
    if (lo.range <= distance && distance <= hi.range) {
      const t = (distance - lo.range) / (hi.range - lo.range);
      const wcLo = lo.windCross ?? 0;
      const wcHi = hi.windCross ?? 0;
      const wlLo = lo.windLong ?? 0;
      const wlHi = hi.windLong ?? 0;
      return {
        wc: wcLo + t * (wcHi - wcLo),
        wl: wlLo + t * (wlHi - wlLo),
      };
    }
  }
  return null;
}

export function calcWindCorrection(
  azimuthDeg: number,
  distance: number,
  windSpeed: number,
  windDir: number,
  charge: Charge,
  weaponId: string,
  ammoId: string,
  windDb: WindDatabase | null,
  mode: MortarMode,
): WindCorrection | null {
  if (windSpeed === 0) return null;

  let wc = 0;
  let wl = 0;
  let dispersion = 0;

  if (mode === 'adult_mortars' && charge.rangeTable.some(e => e.windCross !== undefined)) {
    dispersion = charge.dispersion ?? 0;
    const interp = interpolateWindFromRangeTable(charge.rangeTable, distance);
    if (interp) {
      wc = interp.wc;
      wl = interp.wl;
    }
  } else if (windDb) {
    const charges = windDb.weapons[weaponId]?.[ammoId];
    if (!charges) return null;
    const wCharge = charges.find(c => c.ring === charge.level);
    if (!wCharge) return null;
    dispersion = wCharge.d;
    const interp = interpolateWind(wCharge.t, distance);
    wc = interp.wc;
    wl = interp.wl;
  } else {
    return null;
  }

  // Decompose wind relative to firing direction
  // relAngle: angle of wind relative to shot (0 = headwind, 90 = wind from right)
  const relAngleRad = (windDir - azimuthDeg) * (Math.PI / 180);
  const W_head  = windSpeed * Math.cos(relAngleRad);  // + = headwind
  const W_right = windSpeed * Math.sin(relAngleRad);  // + = from right

  // Wind from right → shell drifts left → aim right (+mils)
  const azDelta = Math.round(wc * W_right / 10);
  // Headwind → shell falls short → effectively need more range (+m)
  const rangeDelta = Math.round(wl * W_head / 10);

  return { azDelta, rangeDelta, dispersion };
}

// ─── Wind correction from an embedded range table (howitzer / M777) ──────────
// The M777 in-game tables carry their own 10 m/s wind columns (windCross mils,
// windLong m), so we read them straight from the chosen charge's table.

function windCorrectionFromTable(
  table: RangeTableEntry[],
  azimuthDeg: number,
  distance: number,
  windSpeed: number,
  windDir: number,
): WindCorrection | null {
  if (windSpeed === 0) return null;
  if (!table.some(e => e.windCross != null || e.windLong != null)) return null;

  const interp = interpolateWindFromRangeTable(table, distance);
  if (!interp) return null;

  const relAngleRad = (windDir - azimuthDeg) * (Math.PI / 180);
  const W_head  = windSpeed * Math.cos(relAngleRad);  // + = headwind
  const W_right = windSpeed * Math.sin(relAngleRad);  // + = from right

  return {
    azDelta:    Math.round(interp.wc * W_right / 10),
    rangeDelta: Math.round(interp.wl * W_head  / 10),
    dispersion: 0,
  };
}

// ─── Main fire solution calculator ───────────────────────────────────────────

export interface WindOpts {
  speed: number;   // m/s
  dir: number;     // degrees FROM which wind blows
  db: WindDatabase | null;
}

export function calculateFireSolution(
  weapon: WeaponSystem,
  ammoId: string,
  mode: MortarMode,
  gunPos: Position,
  targetPos: Position,
  wind?: WindOpts,
  howitzerCharge: HowitzerChargeMode = 'auto',
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

    // ── Wind correction ──
    const azimuthDeg = (azimuthMils / mils) * 360;
    let windAzDelta: number | undefined;
    let windRangeDelta: number | undefined;
    let dispersion: number | undefined;
    let effectiveDistance = distance;

    if (wind && wind.speed > 0) {
      const wc = calcWindCorrection(
        azimuthDeg, distance, wind.speed, wind.dir,
        charge, weapon.id, ammoId, wind.db, mode,
      );
      if (wc) {
        windAzDelta    = wc.azDelta;
        windRangeDelta = wc.rangeDelta;
        dispersion     = wc.dispersion;
        effectiveDistance = distance + wc.rangeDelta;
      } else {
        // No wind table for this ammo/charge — try to get dispersion only
        if (mode === 'adult_mortars') {
          dispersion = charge.dispersion;
        } else if (wind.db) {
          const charges = wind.db.weapons[weapon.id]?.[ammoId];
          const wCharge = charges?.find(c => c.ring === charge.level);
          if (wCharge) dispersion = wCharge.d;
        }
      }
    } else if (wind) {
      // wind.speed === 0, still get dispersion
      if (mode === 'adult_mortars') {
        dispersion = charge.dispersion;
      } else if (wind.db) {
        const charges = wind.db.weapons[weapon.id]?.[ammoId];
        const wCharge = charges?.find(c => c.ring === charge.level);
        if (wCharge) dispersion = wCharge.d;
      }
    }

    const correctedAzMils = windAzDelta
      ? ((azimuthMils + windAzDelta) % mils + mils) % mils
      : azimuthMils;

    const interp = interpolateTable(charge.rangeTable, effectiveDistance);
    if (!interp) return { distance, azimuthMils: correctedAzMils, status: 'no_data', message: 'Ошибка интерполяции' };

    let elevation = interp.elevation;
    if (weapon.usesHeightCorrection) {
      // Higher target (th > gh) → fire further → LOWER elevation for high-angle fire.
      // dElev is the per-100m-height-difference elevation correction; subtract it.
      elevation = Math.round(elevation - (interp.dElev ?? 0) * (th - gh) / 100);
    }

    return {
      distance,
      azimuthMils: correctedAzMils,
      chargeLevel: charge.level,
      elevation,
      tof: interp.tof ?? undefined,
      status: 'ok',
      windAzDelta,
      windRangeDelta,
      dispersion,
    };
  }

  // ── Howitzer / MLRS ─────────────────────────────────────────────────────────
  if (weapon.systemType === 'howitzer' || weapon.systemType === 'mlrs') {
    const group = getHowitzerAmmoGroups(weapon).find(g => g.id === ammoId);
    if (!group) return { distance, azimuthMils, status: 'no_data', message: 'Снаряд не найден' };

    // Resolve which low/high tables to use. For charge-based weapons (M777) the
    // pair comes from the selected charge (auto = lowest charge that reaches).
    let lowPt:  ProjectileType | undefined = group.lowAngle;
    let highPt: ProjectileType | undefined = group.highAngle;
    let chargeLevel: number | undefined;

    if (group.charges?.length) {
      let chosen: HowitzerCharge | null;
      if (howitzerCharge === 'auto') {
        chosen = pickBestHowitzerCharge(group.charges, distance);
      } else {
        chosen = group.charges.find(c => c.charge === howitzerCharge) ?? null;
      }

      if (!chosen) {
        const minR = Math.min(...group.charges.map(c => c.minRange));
        const maxR = Math.max(...group.charges.map(c => c.maxRange));
        return {
          distance, azimuthMils, status: 'out_of_range',
          message: `Вне зоны • ${Math.round(distance)} м (диап. ${minR}–${maxR})`,
        };
      }

      // Manual charge that can't reach: name the charges that can.
      if (howitzerCharge !== 'auto' &&
          (distance < chosen.minRange || distance > chosen.maxRange)) {
        const reachable = group.charges
          .filter(c => distance >= c.minRange && distance <= c.maxRange)
          .map(c => c.charge);
        const hint = reachable.length
          ? `достают: ${reachable.join(', ')}`
          : `диап. заряда ${chosen.charge}: ${chosen.minRange}–${chosen.maxRange}`;
        return {
          distance, azimuthMils, status: 'out_of_range',
          message: `Заряд ${chosen.charge} не достаёт • ${Math.round(distance)} м (${hint})`,
        };
      }

      lowPt = chosen.lowAngle;
      highPt = chosen.highAngle;
      chargeLevel = chosen.charge;
    }

    const interpPt = (pt?: ProjectileType) => {
      if (!pt) return undefined;
      if (distance < pt.minRange || distance > pt.maxRange) return undefined;
      return interpolateTable(pt.ballisticTable, distance);
    };

    const low  = interpPt(lowPt);
    const high = interpPt(highPt);

    if (!low && !high) {
      const pts = [lowPt, highPt].filter(Boolean) as ProjectileType[];
      const minR = pts.length ? Math.min(...pts.map(pt => pt.minRange)) : 0;
      const maxR = pts.length ? Math.max(...pts.map(pt => pt.maxRange)) : 0;
      return {
        distance, azimuthMils, status: 'out_of_range',
        message: `Вне зоны • ${Math.round(distance)} м (диап. ${minR}–${maxR})`,
      };
    }

    const dispersion = lowPt?.dispersion ?? highPt?.dispersion;
    const dH = th - gh;
    const azimuthDeg = (azimuthMils / mils) * 360;

    // Solve a single trajectory. Wind is read from THIS angle's own cross/long
    // columns — low and high diverge hard (high-angle flies ~2.5× longer, so its
    // crosswind drift and headwind range bias are several times larger). Then apply
    // the per-angle height correction.
    const solveAngle = (
      pt: ProjectileType | undefined,
      base: { elevation: number; tof: number | null; dElev: number } | null,
    ) => {
      if (!pt || !base) return undefined;
      let interp = base;
      let az = azimuthMils;
      let azDelta: number | undefined;
      let rangeDelta: number | undefined;

      if (wind && wind.speed > 0) {
        const wc = windCorrectionFromTable(
          pt.ballisticTable, azimuthDeg, distance, wind.speed, wind.dir,
        );
        if (wc) {
          azDelta = wc.azDelta;
          rangeDelta = wc.rangeDelta;
          az = ((azimuthMils + wc.azDelta) % mils + mils) % mils;
          const eff = distance + wc.rangeDelta;
          if (eff >= pt.minRange && eff <= pt.maxRange) {
            interp = interpolateTable(pt.ballisticTable, eff) ?? base;
          }
        }
      }

      let elev = interp.elevation;
      if (weapon.usesHeightCorrection && dH !== 0) {
        if (pt.variant === 'low_angle') {
          // Flat fire: geometric angle of site dominates (table dElev understates it).
          elev = Math.round(elev + Math.atan2(dH, distance) * mils / (2 * Math.PI));
        } else {
          // Steep fire: small ballistic correction from the table's dElev.
          elev = Math.round(elev - (interp.dElev ?? 0) * dH / 100);
        }
      }

      return { elev, az, azDelta, rangeDelta, tof: interp.tof ?? undefined };
    };

    const sLow  = solveAngle(lowPt, low ?? null);
    const sHigh = solveAngle(highPt, high ?? null);

    return {
      distance,
      azimuthMils,                       // base (geometric) bearing
      chargeLevel,
      elevationLow:   sLow?.elev,
      elevationHigh:  sHigh?.elev,
      azimuthMilsLow:  sLow?.az,
      azimuthMilsHigh: sHigh?.az,
      tofLow:  sLow?.tof,
      tofHigh: sHigh?.tof,
      tof: sLow?.tof ?? sHigh?.tof ?? undefined,
      windAzDeltaLow:     sLow?.azDelta,
      windAzDeltaHigh:    sHigh?.azDelta,
      windRangeDeltaLow:  sLow?.rangeDelta,
      windRangeDeltaHigh: sHigh?.rangeDelta,
      status: 'ok',
      dispersion,
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

// ─── Max range helper ─────────────────────────────────────────────────────────

export function getMaxRange(
  weapon: WeaponSystem,
  ammoId: string,
  mode: MortarMode,
): number | null {
  if (weapon.systemType === 'mortar') {
    const ammo = weapon.ammo?.find(a => a.id === ammoId);
    if (!ammo) return null;
    const modeData = mode === 'adult_mortars' && ammo.modes.adult_mortars
      ? ammo.modes.adult_mortars
      : ammo.modes.original;
    if (!modeData?.charges?.length) return null;
    return Math.max(...modeData.charges.map(c => c.maxRange));
  }
  if (weapon.systemType === 'howitzer' || weapon.systemType === 'mlrs') {
    const group = getHowitzerAmmoGroups(weapon).find(g => g.id === ammoId);
    if (!group) return null;
    const ranges = group.charges?.length
      ? group.charges.map(c => c.maxRange)
      : [group.lowAngle?.maxRange, group.highAngle?.maxRange]
          .filter((v): v is number => v !== undefined);
    return ranges.length ? Math.max(...ranges) : null;
  }
  return null;
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
