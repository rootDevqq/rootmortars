import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import {
  calculateFireSolution,
  formatMils,
  getMilsPerCircle,
} from '../utils/ballistics';
import type { FireSolution } from '../types';

// ─── Grid SVG icon ────────────────────────────────────────────────────────────

function GridIcon({ color = '#f59e0b' }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" style={{ flexShrink: 0 }}>
      <rect x="1"  y="1"  width="5" height="5" rx="1" fill={color} />
      <rect x="8"  y="1"  width="5" height="5" rx="1" fill={color} />
      <rect x="1"  y="8"  width="5" height="5" rx="1" fill={color} />
      <rect x="8"  y="8"  width="5" height="5" rx="1" fill={color} />
    </svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawPoint {
  col: number;
  row: number;
  x: number;
  y: number;
  sol: FireSolution | null;
}

interface GridPoint extends RawPoint {
  index: number;
}

type FirePattern = 'rows' | 'snake' | 'spiral' | 'center' | 'random';

// ─── Pattern metadata ─────────────────────────────────────────────────────────

const PATTERNS: { id: FirePattern; label: string; desc: string; icon: string }[] = [
  { id: 'rows',   label: 'Ряды',      desc: 'Слева направо, ряд за рядом',          icon: '≡' },
  { id: 'snake',  label: 'Змейка',    desc: 'Рядами с чередованием направления',     icon: '⟿' },
  { id: 'spiral', label: 'Спираль',   desc: 'По периметру снаружи к центру',         icon: '◎' },
  { id: 'center', label: 'Из центра', desc: 'От центра к краям по удалению',         icon: '⊕' },
  { id: 'random', label: 'Рандом',    desc: 'Случайный порядок — непредсказуемо',    icon: '⁕' },
];

// ─── Pattern ordering ─────────────────────────────────────────────────────────

function applyPattern(
  pts: RawPoint[],
  cols: number,
  rows: number,
  pattern: FirePattern,
): RawPoint[] {
  switch (pattern) {

    case 'rows':
      return [...pts];

    case 'snake': {
      const result: RawPoint[] = [];
      for (let r = 0; r < rows; r++) {
        const row = pts.filter(p => p.row === r);
        result.push(...(r % 2 === 0 ? row : [...row].reverse()));
      }
      return result;
    }

    case 'spiral': {
      // Build lookup matrix
      const mx: (RawPoint | undefined)[][] =
        Array.from({ length: rows }, () => Array(cols).fill(undefined));
      for (const p of pts) mx[p.row][p.col] = p;

      const result: RawPoint[] = [];
      let top = 0, bottom = rows - 1, left = 0, right = cols - 1;
      while (top <= bottom && left <= right) {
        for (let c = left; c <= right; c++)  { const p = mx[top]?.[c];    if (p) result.push(p); } top++;
        for (let r = top; r <= bottom; r++)  { const p = mx[r]?.[right];  if (p) result.push(p); } right--;
        if (top <= bottom) {
          for (let c = right; c >= left; c--) { const p = mx[bottom]?.[c]; if (p) result.push(p); } bottom--;
        }
        if (left <= right) {
          for (let r = bottom; r >= top; r--) { const p = mx[r]?.[left];   if (p) result.push(p); } left++;
        }
      }
      return result;
    }

    case 'center': {
      const cx = (cols - 1) / 2, cy = (rows - 1) / 2;
      return [...pts].sort((a, b) => {
        const da = (a.col - cx) ** 2 + (a.row - cy) ** 2;
        const db = (b.col - cx) ** 2 + (b.row - cy) ** 2;
        return da - db;
      });
    }

    case 'random': {
      const arr = [...pts];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STEP_OPTIONS = [10, 25, 50, 100, 200, 500];

// ─── Component ────────────────────────────────────────────────────────────────

export function AreaFire() {
  const {
    weaponSystems, selectedWeaponId, selectedAmmoId,
    mortarMode, howitzerCharge, gunPos, targetPos,
  } = useAppStore();

  const [open, setOpen]         = useState(false);
  const [cx, setCx]             = useState('');
  const [cy, setCy]             = useState('');
  const [ch, setCh]             = useState('');   // высота зоны
  const [width, setWidth]       = useState(200);
  const [height, setHeight]     = useState(200);
  const [step, setStep]         = useState(50);
  const [pattern, setPattern]   = useState<FirePattern>('rows');
  const [results, setResults]   = useState<GridPoint[] | null>(null);

  const weapon     = weaponSystems.find(w => w.id === selectedWeaponId);
  const mils       = weapon ? getMilsPerCircle(weapon) : 6400;
  const isMortar   = weapon?.systemType === 'mortar';
  const hasCharges = !!weapon?.hasCharges;
  const hasGun     = gunPos.x !== '' && gunPos.y !== '';

  const colCount    = Math.max(1, Math.floor(width  / step) + 1);
  const rowCount    = Math.max(1, Math.floor(height / step) + 1);
  const totalRounds = colCount * rowCount;

  const fillFromTarget = () => {
    if (targetPos.x !== '') setCx(String(targetPos.x));
    if (targetPos.y !== '') setCy(String(targetPos.y));
    if (targetPos.h !== '') setCh(String(targetPos.h));
    setResults(null);
  };

  const calculate = () => {
    const centerX = Number(cx), centerY = Number(cy);
    if (!weapon || !hasGun || isNaN(centerX) || isNaN(centerY)) return;

    const halfW = width  / 2;
    const halfH = height / 2;
    const startX = centerX - halfW;
    const startY = centerY - halfH;
    const gx = Number(gunPos.x), gy = Number(gunPos.y), gh = Number(gunPos.h) || 0;
    const targetH = ch !== '' ? Number(ch) : 0;

    const raw: RawPoint[] = [];
    for (let rowIdx = 0; rowIdx < rowCount; rowIdx++) {
      for (let colIdx = 0; colIdx < colCount; colIdx++) {
        const px = Math.round(startX + colIdx * step);
        const py = Math.round(startY + rowIdx * step);
        raw.push({
          col: colIdx, row: rowIdx, x: px, y: py,
          sol: calculateFireSolution(
            weapon, selectedAmmoId, mortarMode,
            { x: gx, y: gy, h: gh },
            { x: px, y: py, h: targetH },
            undefined, howitzerCharge,
          ),
        });
      }
    }

    const ordered = applyPattern(raw, colCount, rowCount, pattern);
    setResults(ordered.map((p, i) => ({ ...p, index: i + 1 })));
  };

  const roundsColor = totalRounds > 30 ? '#f87171' : totalRounds > 15 ? '#fbbf24' : '#4ade80';
  const canCalc = hasGun && !!weapon && cx !== '' && cy !== '';

  return (
    <div className="card">

      {/* ── Collapsible header ── */}
      <button
        style={{
          width: '100%', padding: '10px 12px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'transparent', border: 'none', cursor: 'pointer',
        }}
        onClick={() => setOpen(v => !v)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <GridIcon />
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
            color: '#f59e0b', fontFamily: 'JetBrains Mono, monospace',
          }}>
            НАКРЫТИЕ КВАДРАТА
          </span>
          {results && (
            <span className="badge-amber" style={{ fontSize: 9 }}>
              {results.length} точек
            </span>
          )}
        </div>
        <span style={{ fontSize: 11, color: '#475569' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Центр квадрата */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="section-label mb-0">Центр зоны</span>
              <button
                className="btn-secondary"
                style={{ fontSize: 10, padding: '2px 8px' }}
                onClick={fillFromTarget}
                disabled={targetPos.x === '' && targetPos.y === ''}
              >
                ← Из цели
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="field-label">X</label>
                <input type="number" className="input-sm" placeholder="4478"
                  value={cx} onChange={e => { setCx(e.target.value); setResults(null); }} />
              </div>
              <div>
                <label className="field-label">Y</label>
                <input type="number" className="input-sm" placeholder="661"
                  value={cy} onChange={e => { setCy(e.target.value); setResults(null); }} />
              </div>
              <div>
                <label className="field-label" style={{ color: isMortar ? '#f59e0b' : undefined }}>
                  H {isMortar && <span style={{ color: '#f59e0b', fontSize: 8 }}>важно</span>}
                </label>
                <input type="number" className="input-sm" placeholder="116"
                  value={ch} onChange={e => { setCh(e.target.value); setResults(null); }} />
              </div>
            </div>
            {isMortar && ch === '' && (
              <div style={{ fontSize: 10, color: '#f59e0b80', marginTop: 4 }}>
                ⚠ Для миномёта высота влияет на угол возвышения — рекомендуется указать
              </div>
            )}
          </div>

          {/* Размеры и шаг */}
          <div>
            <span className="section-label mb-2">Зона и шаг</span>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="field-label">Ширина (м)</label>
                <input type="number" className="input-sm" min={10} value={width}
                  onChange={e => { setWidth(Math.max(10, Number(e.target.value))); setResults(null); }} />
              </div>
              <div>
                <label className="field-label">Высота (м)</label>
                <input type="number" className="input-sm" min={10} value={height}
                  onChange={e => { setHeight(Math.max(10, Number(e.target.value))); setResults(null); }} />
              </div>
              <div>
                <label className="field-label">Шаг (м)</label>
                <input type="number" className="input-sm" min={5} value={step}
                  onChange={e => { setStep(Math.max(5, Number(e.target.value))); setResults(null); }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: '#475569' }}>Шаг:</span>
              {STEP_OPTIONS.map(s => (
                <button key={s}
                  style={{
                    padding: '2px 6px', fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 700, borderRadius: 4, cursor: 'pointer',
                    border: `1px solid ${step === s ? '#f59e0b' : '#1e2a3a'}`,
                    background: step === s ? '#78350f40' : 'transparent',
                    color: step === s ? '#f59e0b' : '#475569', transition: 'all 0.1s',
                  }}
                  onClick={() => { setStep(s); setResults(null); }}
                >
                  {s}м
                </button>
              ))}
            </div>
          </div>

          {/* Паттерн распределения */}
          <div>
            <span className="section-label mb-2">Порядок огня</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {PATTERNS.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setPattern(p.id); setResults(null); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 10px', borderRadius: 5, cursor: 'pointer', textAlign: 'left',
                    border: `1px solid ${pattern === p.id ? '#f59e0b80' : '#1e2a3a'}`,
                    background: pattern === p.id ? '#78350f30' : '#0d1219',
                    transition: 'all 0.1s',
                  }}
                >
                  <span style={{
                    fontSize: 14, color: pattern === p.id ? '#f59e0b' : '#475569',
                    flexShrink: 0, width: 18, textAlign: 'center',
                  }}>
                    {p.icon}
                  </span>
                  <div>
                    <div style={{
                      fontSize: 11, fontWeight: 700,
                      fontFamily: 'JetBrains Mono, monospace',
                      color: pattern === p.id ? '#fde68a' : '#94a3b8',
                    }}>
                      {p.label}
                    </div>
                    <div style={{ fontSize: 9, color: '#475569', marginTop: 1 }}>
                      {p.desc}
                    </div>
                  </div>
                  {pattern === p.id && (
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: '#f59e0b' }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Инфо */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#475569' }}>
              Сетка: <strong style={{ color: '#94a3b8' }}>{colCount}×{rowCount}</strong>
            </span>
            <span style={{ fontSize: 11, color: '#475569' }}>
              Снарядов: <strong style={{ color: roundsColor }}>{totalRounds}</strong>
            </span>
            <span style={{ fontSize: 11, color: '#475569' }}>
              {width}×{height} м
            </span>
          </div>

          {!hasGun && (
            <div style={{ fontSize: 11, color: '#f87171', background: '#7f1d1d20', borderRadius: 4, padding: '6px 10px' }}>
              ⚠ Введите позицию орудия
            </div>
          )}

          {/* Кнопка расчёта */}
          <button
            className="btn-fire"
            style={{
              fontSize: 12, padding: '8px 12px',
              background: 'linear-gradient(135deg, #78350f, #92400e)',
              borderColor: '#f59e0b50', color: '#fde68a',
            }}
            onClick={calculate}
            disabled={!canCalc}
          >
            <GridIcon color="#fde68a" />
            <span style={{ marginLeft: 6 }}>РАССЧИТАТЬ НАКРЫТИЕ</span>
          </button>

          {/* Таблица результатов */}
          {results && results.length > 0 && (
            <div style={{ overflowX: 'auto', marginTop: 2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: '#475569' }}>
                  {results.filter(r => r.sol?.status === 'ok').length} / {results.length} в зоне досягаемости
                </span>
                <span style={{ fontSize: 10, color: '#475569' }}>
                  {PATTERNS.find(p => p.id === pattern)?.label}
                </span>
              </div>
              <table style={{
                width: '100%', borderCollapse: 'collapse',
                fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
              }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1e2a3a' }}>
                    <th style={thStyle}>#</th>
                    <th style={thStyle}>X / Y</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>АЗ (mil)</th>
                    {isMortar ? (
                      <>
                        <th style={{ ...thStyle, textAlign: 'right' }}>ВОЗВ</th>
                        <th style={{ ...thStyle, textAlign: 'right', color: '#f59e0b' }}>ЗАР</th>
                      </>
                    ) : (
                      <>
                        {hasCharges && (
                          <th style={{ ...thStyle, textAlign: 'right', color: '#c084fc' }}>ЗАР</th>
                        )}
                        <th style={{ ...thStyle, textAlign: 'right', color: '#38bdf8' }}>LOW</th>
                        <th style={{ ...thStyle, textAlign: 'right', color: '#c084fc' }}>HIGH</th>
                      </>
                    )}
                    <th style={{ ...thStyle, textAlign: 'right' }}>ДИСТ</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => {
                    const ok  = r.sol != null && r.sol.status === 'ok';
                    const sol = r.sol;
                    return (
                      <tr key={i} style={{
                        borderBottom: '1px solid #0f1621',
                        background: i % 2 === 0 ? '#0d1219' : 'transparent',
                        opacity: ok ? 1 : 0.45,
                      }}>
                        <td style={tdStyle}>{r.index}</td>
                        <td style={{ ...tdStyle, color: '#64748b' }}>{r.x}/{r.y}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: ok ? '#22c55e' : '#334155', fontWeight: 700 }}>
                          {ok && sol ? formatMils(sol.azimuthMils, mils) : '—'}
                        </td>
                        {isMortar ? (
                          <>
                            <td style={{ ...tdStyle, textAlign: 'right', color: ok ? '#38bdf8' : '#334155' }}>
                              {ok && sol && sol.elevation !== undefined ? sol.elevation : '—'}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right', color: ok ? '#f59e0b' : '#334155' }}>
                              {ok && sol && sol.chargeLevel !== undefined ? sol.chargeLevel : '—'}
                            </td>
                          </>
                        ) : (
                          <>
                            {hasCharges && (
                              <td style={{ ...tdStyle, textAlign: 'right', color: ok ? '#c084fc' : '#334155' }}>
                                {ok && sol && sol.chargeLevel !== undefined ? sol.chargeLevel : '—'}
                              </td>
                            )}
                            <td style={{ ...tdStyle, textAlign: 'right', color: ok ? '#38bdf8' : '#334155' }}>
                              {ok && sol && sol.elevationLow !== undefined ? sol.elevationLow : '—'}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right', color: ok ? '#c084fc' : '#334155' }}>
                              {ok && sol && sol.elevationHigh !== undefined ? sol.elevationHigh : '—'}
                            </td>
                          </>
                        )}
                        <td style={{ ...tdStyle, textAlign: 'right', color: '#64748b' }}>
                          {ok && sol ? `${Math.round(sol.distance)}м` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Table styles ─────────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  padding: '4px 6px', textAlign: 'left',
  color: '#475569', fontWeight: 700, fontSize: 9, letterSpacing: '0.1em',
  textTransform: 'uppercase',
};

const tdStyle: React.CSSProperties = {
  padding: '3px 6px', fontSize: 11, color: '#94a3b8',
};
