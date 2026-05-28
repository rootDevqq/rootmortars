import { useAppStore } from '../store/appStore';
import { getMilsPerCircle, formatMils, formatTof } from '../utils/ballistics';
import type { FireSolution } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function milsToDeg(mils: number, milsPerCircle: number): string {
  return ((mils / milsPerCircle) * 360).toFixed(1);
}

// ─── SVG Compass ─────────────────────────────────────────────────────────────

function Compass({ azMils, milsPerCircle }: { azMils: number; milsPerCircle: number }) {
  const deg = (azMils / milsPerCircle) * 360;
  const R = 46;
  const cx = 50, cy = 50;

  const rad = (deg - 90) * (Math.PI / 180);
  const nx = cx + R * Math.cos(rad);
  const ny = cy + R * Math.sin(rad);

  const ticks = [0, 90, 180, 270];
  const tickLabels = ['С', 'В', 'Ю', 'З'];

  return (
    <svg width="100" height="100" viewBox="0 0 100 100">
      {/* Outer ring */}
      <circle cx={cx} cy={cy} r={48} fill="none" stroke="#1e2a3a" strokeWidth="1.5" />
      <circle cx={cx} cy={cy} r={42} fill="#0a0e14" stroke="#263448" strokeWidth="1" />

      {/* Degree ring ticks */}
      {Array.from({ length: 36 }).map((_, i) => {
        const a = (i * 10 - 90) * (Math.PI / 180);
        const r1 = i % 9 === 0 ? 39 : 41;
        const r2 = 42;
        return (
          <line
            key={i}
            x1={cx + r1 * Math.cos(a)} y1={cy + r1 * Math.sin(a)}
            x2={cx + r2 * Math.cos(a)} y2={cy + r2 * Math.sin(a)}
            stroke={i % 9 === 0 ? '#38bdf8' : '#263448'}
            strokeWidth={i % 9 === 0 ? 1.5 : 0.8}
          />
        );
      })}

      {/* Cardinal labels */}
      {ticks.map((t, i) => {
        const a = (t - 90) * (Math.PI / 180);
        const labelR = 34;
        return (
          <text
            key={t}
            x={cx + labelR * Math.cos(a)}
            y={cy + labelR * Math.sin(a)}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="8"
            fontFamily="JetBrains Mono, monospace"
            fontWeight="700"
            fill="#475569"
          >
            {tickLabels[i]}
          </text>
        );
      })}

      {/* Azimuth needle */}
      <line
        x1={cx} y1={cy}
        x2={nx} y2={ny}
        stroke="#22c55e"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx={nx} cy={ny} r="3" fill="#22c55e" />

      {/* Center dot */}
      <circle cx={cx} cy={cy} r="4" fill="#111720" stroke="#22c55e" strokeWidth="1.5" />
    </svg>
  );
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const copy = () => navigator.clipboard?.writeText(text).catch(() => {});
  return (
    <button
      className="btn-ghost"
      style={{ fontSize: 10, padding: '3px 8px' }}
      onClick={copy}
      title="Скопировать"
    >
      COPY
    </button>
  );
}

// ─── Build copy text ──────────────────────────────────────────────────────────

function buildCopyText(sol: FireSolution, mils: number, isMortar: boolean): string {
  const az = formatMils(sol.azimuthMils, mils);
  const parts = [`Az: ${az} mil`, `Dist: ${Math.round(sol.distance)} м`];
  if (isMortar) {
    if (sol.elevation !== undefined)  parts.push(`Elev: ${sol.elevation} mil`);
    if (sol.chargeLevel !== undefined) parts.push(`Charge: ${sol.chargeLevel}`);
  } else {
    if (sol.elevationLow  !== undefined) parts.push(`LOW: ${sol.elevationLow} mil`);
    if (sol.elevationHigh !== undefined) parts.push(`HIGH: ${sol.elevationHigh} mil`);
  }
  if (sol.tof != null) parts.push(`TOF: ${sol.tof.toFixed(1)} с`);
  if (sol.windAzDelta !== undefined) parts.push(`ΔAz(ветер): ${sol.windAzDelta > 0 ? '+' : ''}${sol.windAzDelta} mil`);
  return parts.join(' | ');
}

// ─── Wind correction badge ────────────────────────────────────────────────────

function WindBadge({ azDelta, rangeDelta }: { azDelta?: number; rangeDelta?: number }) {
  if (azDelta === undefined && rangeDelta === undefined) return null;
  return (
    <div style={{
      display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4,
      padding: '4px 8px', borderRadius: 4, background: '#0c4a6e20',
      border: '1px solid #0c4a6e',
    }}>
      <span style={{ fontSize: 9, color: '#38bdf8', fontWeight: 700, fontFamily: 'JetBrains Mono', letterSpacing: '0.05em' }}>
        ПОПРАВКА ВЕТЕР
      </span>
      {azDelta !== undefined && azDelta !== 0 && (
        <span style={{ fontSize: 10, color: '#7dd3fc', fontFamily: 'JetBrains Mono' }}>
          Az {azDelta > 0 ? '+' : ''}{azDelta} mil
        </span>
      )}
      {rangeDelta !== undefined && rangeDelta !== 0 && (
        <span style={{ fontSize: 10, color: '#7dd3fc', fontFamily: 'JetBrains Mono' }}>
          Д {rangeDelta > 0 ? '+' : ''}{rangeDelta} м
        </span>
      )}
      {((azDelta === 0 || azDelta === undefined) && (rangeDelta === 0 || rangeDelta === undefined)) && (
        <span style={{ fontSize: 10, color: '#334155', fontFamily: 'JetBrains Mono' }}>0 (штиль)</span>
      )}
    </div>
  );
}

// ─── Degree badge ─────────────────────────────────────────────────────────────

function DegBadge({ value, mpc }: { value: number; mpc: number }) {
  return (
    <span style={{
      fontSize: 11, color: '#475569', fontWeight: 500,
      fontFamily: 'JetBrains Mono, monospace', marginLeft: 4,
    }}>
      ({milsToDeg(value, mpc)}°)
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FireResult() {
  const { fireSolution, weaponSystems, selectedWeaponId } = useAppStore();
  const weapon   = weaponSystems.find(w => w.id === selectedWeaponId);
  const mils     = weapon ? getMilsPerCircle(weapon) : 6400;
  const isMortar = weapon?.systemType === 'mortar';

  // Empty state
  if (!fireSolution) {
    return (
      <div className="card p-4 flex flex-col items-center justify-center gap-2" style={{ minHeight: 140 }}>
        <div style={{ fontSize: 28, opacity: 0.2 }}>◎</div>
        <div style={{ fontSize: 12, color: '#334155', textAlign: 'center' }}>
          Введите координаты и нажмите РАССЧИТАТЬ
        </div>
      </div>
    );
  }

  // Out of range
  if (fireSolution.status === 'out_of_range') {
    return (
      <div className="card p-4 fade-in" style={{ borderColor: '#7f1d1d' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="badge-red">ВНЕ ЗОНЫ</span>
          <span style={{ fontSize: 10, color: '#475569' }}>{weapon?.name}</span>
        </div>
        <div style={{ color: '#f87171', fontSize: 12, marginBottom: 10 }}>{fireSolution.message}</div>
        <div className="flex gap-4">
          <div className="sol-block">
            <span className="sol-label">Дистанция</span>
            <span className="sol-value-sm" style={{ color: '#475569' }}>
              {Math.round(fireSolution.distance)} <span className="sol-unit">м</span>
            </span>
          </div>
          <div className="sol-block">
            <span className="sol-label">Азимут</span>
            <span className="sol-value-sm" style={{ color: '#475569' }}>
              {formatMils(fireSolution.azimuthMils, mils)} <span className="sol-unit">mil</span>
              <DegBadge value={fireSolution.azimuthMils} mpc={mils} />
            </span>
          </div>
        </div>
      </div>
    );
  }

  // No data
  if (fireSolution.status === 'no_data') {
    return (
      <div className="card p-4 fade-in" style={{ borderColor: '#78350f' }}>
        <span className="badge-amber">НЕТ ДАННЫХ</span>
        <div style={{ color: '#fbbf24', fontSize: 12, marginTop: 8 }}>{fireSolution.message}</div>
      </div>
    );
  }

  // OK
  const copyText = buildCopyText(fireSolution, mils, isMortar);

  return (
    <div className="card p-4 fade-in" style={{ borderColor: '#14532d' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="badge-green">РЕШЕНИЕ</span>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 10, color: '#475569' }}>{weapon?.name}</span>
          <CopyBtn text={copyText} />
        </div>
      </div>

      {/* Main content: compass + values */}
      <div className="flex gap-4 items-start">
        {/* Compass */}
        <div className="shrink-0">
          <Compass azMils={fireSolution.azimuthMils} milsPerCircle={mils} />
        </div>

        {/* Right side values */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {/* Azimuth — hero value */}
          <div className="sol-block">
            <span className="sol-label">Азимут</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, flexWrap: 'wrap' }}>
              <span className="sol-value-xl">{formatMils(fireSolution.azimuthMils, mils)}</span>
              <span className="sol-unit" style={{ fontSize: 14 }}>mil</span>
              <DegBadge value={fireSolution.azimuthMils} mpc={mils} />
            </div>
          </div>

          {/* Distance */}
          <div className="sol-block">
            <span className="sol-label">Дистанция</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span className="sol-value-sm">{Math.round(fireSolution.distance)}</span>
              <span className="sol-unit">м</span>
            </div>
          </div>
        </div>
      </div>

      {/* Elevation row */}
      <div className="divider" style={{ margin: '10px 0' }} />

      {isMortar ? (
        <>
        <div className="flex gap-4 flex-wrap">
          {/* Elevation */}
          <div className="sol-block">
            <span className="sol-label">Возвышение</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, flexWrap: 'wrap' }}>
              <span className="sol-value-lg">
                {fireSolution.elevation !== undefined ? fireSolution.elevation : '—'}
              </span>
              <span className="sol-unit" style={{ fontSize: 12 }}>mil</span>
              {fireSolution.elevation !== undefined && (
                <DegBadge value={fireSolution.elevation} mpc={mils} />
              )}
            </div>
          </div>

          {/* Charge */}
          <div className="sol-block">
            <span className="sol-label">Заряд</span>
            <span className="sol-value-md">
              {fireSolution.chargeLevel !== undefined ? fireSolution.chargeLevel : '—'}
            </span>
          </div>

          {/* TOF */}
          {fireSolution.tof != null && (
            <div className="sol-block">
              <span className="sol-label">TOF</span>
              <span className="sol-value-sm">{formatTof(fireSolution.tof)}</span>
            </div>
          )}

          {/* Dispersion */}
          {fireSolution.dispersion !== undefined && (
            <div className="sol-block">
              <span className="sol-label">Разброс</span>
              <span className="sol-value-sm" style={{ color: '#94a3b8' }}>
                {fireSolution.dispersion} <span className="sol-unit">м</span>
              </span>
            </div>
          )}
        </div>

        {/* Wind correction row */}
        {(fireSolution.windAzDelta !== undefined || fireSolution.windRangeDelta !== undefined) && (
          <WindBadge azDelta={fireSolution.windAzDelta} rangeDelta={fireSolution.windRangeDelta} />
        )}
        </>
      ) : (
        <div className="flex gap-4 flex-wrap">
          {/* LOW */}
          {fireSolution.elevationLow !== undefined && (
            <div className="sol-block">
              <span className="sol-label" style={{ color: '#38bdf8' }}>LOW</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, flexWrap: 'wrap' }}>
                <span className="sol-value-lg">{fireSolution.elevationLow}</span>
                <span className="sol-unit" style={{ fontSize: 12 }}>mil</span>
                <DegBadge value={fireSolution.elevationLow} mpc={mils} />
              </div>
            </div>
          )}

          {/* HIGH */}
          {fireSolution.elevationHigh !== undefined && (
            <div className="sol-block">
              <span className="sol-label" style={{ color: '#c084fc' }}>HIGH</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, flexWrap: 'wrap' }}>
                <span className="sol-value-lg" style={{ color: '#c084fc' }}>
                  {fireSolution.elevationHigh}
                </span>
                <span className="sol-unit" style={{ fontSize: 12 }}>mil</span>
                <DegBadge value={fireSolution.elevationHigh} mpc={mils} />
              </div>
            </div>
          )}

          {/* TOF */}
          {fireSolution.tof != null && (
            <div className="sol-block">
              <span className="sol-label">TOF</span>
              <span className="sol-value-sm">{formatTof(fireSolution.tof)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
