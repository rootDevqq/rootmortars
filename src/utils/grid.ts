// ─── Grid reference utilities ─────────────────────────────────────────────────
//
// Arma Reforger uses a metric coordinate system (meters).
// Grid references are derived from raw X/Y by dividing into 100m or 10m cells.
//
// 4-digit  (XX YY)          1000m precision  — major grid squares only
// 6-digit  (XXX YYY)         100m precision  — standard call-out format
// 8-digit  (XXXX YYYY)        10m precision  — precise targeting
//
// Example: X=5319, Y=3278
//   4-digit → "05-03"   (5000m, 3000m)
//   6-digit → "053-032" (5300m, 3200m)
//   8-digit → "0531-0327" (5310m, 3270m)

export type GridPrecision = 4 | 6 | 8;

// ─── Coords → Grid string (raw, no separator) ─────────────────────────────────

export function coordsToGrid(x: number, y: number, precision: GridPrecision = 6): string {
  switch (precision) {
    case 4: {
      const ex = Math.floor(x / 1000).toString().padStart(2, '0');
      const ny = Math.floor(y / 1000).toString().padStart(2, '0');
      return ex + ny;
    }
    case 6: {
      const ex = Math.floor(x / 100).toString().padStart(3, '0');
      const ny = Math.floor(y / 100).toString().padStart(3, '0');
      return ex + ny;
    }
    case 8: {
      const ex = Math.floor(x / 10).toString().padStart(4, '0');
      const ny = Math.floor(y / 10).toString().padStart(4, '0');
      return ex + ny;
    }
  }
}

// ─── Add dash separator in the middle ────────────────────────────────────────

export function formatGrid(raw: string): string {
  const clean = raw.replace(/[\s\-_]/g, '');
  const half = Math.floor(clean.length / 2);
  if (half === 0) return clean;
  return `${clean.slice(0, half)}-${clean.slice(half)}`;
}

// ─── Grid string → Coords ─────────────────────────────────────────────────────

export type GridParseResult =
  | { ok: true;  x: number; y: number; precision: GridPrecision }
  | { ok: false; error: string };

export function gridToCoords(input: string): GridParseResult {
  const clean = input.replace(/[\s\-_]/g, '');

  if (!/^\d+$/.test(clean) || clean.length === 0) {
    return { ok: false, error: 'Только цифры (4, 6 или 8 знаков)' };
  }

  if (clean.length === 4) {
    const ex = parseInt(clean.slice(0, 2), 10);
    const ny = parseInt(clean.slice(2, 4), 10);
    return { ok: true, x: ex * 1000, y: ny * 1000, precision: 4 };
  }

  if (clean.length === 6) {
    const ex = parseInt(clean.slice(0, 3), 10);
    const ny = parseInt(clean.slice(3, 6), 10);
    return { ok: true, x: ex * 100, y: ny * 100, precision: 6 };
  }

  if (clean.length === 8) {
    const ex = parseInt(clean.slice(0, 4), 10);
    const ny = parseInt(clean.slice(4, 8), 10);
    return { ok: true, x: ex * 10, y: ny * 10, precision: 8 };
  }

  return { ok: false, error: `${clean.length} знаков — нужно 4, 6 или 8` };
}

// ─── Precision label ──────────────────────────────────────────────────────────

export function precisionLabel(p: GridPrecision): string {
  return { 4: '1000м', 6: '100м', 8: '10м' }[p];
}
