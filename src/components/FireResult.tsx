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
  const parts: string[] = [`Dist: ${Math.round(sol.distance)} м`];
  if (isMortar) {
    parts.unshift(`Az: ${formatMils(sol.azimuthMils, mils)} mil`);
    if (sol.elevation !== undefined)  parts.push(`Elev: ${sol.elevation} mil`);
    if (sol.chargeLevel !== undefined) parts.push(`Charge: ${sol.chargeLevel}`);
    if (sol.tof != null) parts.push(`TOF: ${sol.tof.toFixed(1)} с`);
    if (sol.windAzDelta !== undefined) parts.push(`ΔAz(ветер): ${sol.windAzDelta > 0 ? '+' : ''}${sol.windAzDelta} mil`);
  } else {
    if (sol.chargeLevel !== undefined) parts.push(`Заряд: ${sol.chargeLevel}`);
    if (sol.elevationLow !== undefined) {
      const az = formatMils(sol.azimuthMilsLow ?? sol.azimuthMils, mils);
      parts.push(`LOW az ${az} / возв ${sol.elevationLow}` + (sol.tofLow != null ? ` / ${sol.tofLow.toFixed(1)}с` : ''));
    }
    if (sol.elevationHigh !== undefined) {
      const az = formatMils(sol.azimuthMilsHigh ?? sol.azimuthMils, mils);
      parts.push(`HIGH az ${az} / возв ${sol.elevationHigh}` + (sol.tofHigh != null ? ` / ${sol.tofHigh.toFixed(1)}с` : ''));
    }
  }
  return parts.join(' | ');
}

// ─── Per-trajectory solution row (howitzer LOW / HIGH) ───────────────────────

function TrajRow({
  label, color, az, elev, tof, mils,
}: { label: string; color: string; az?: number; elev: number; tof?: number; mils: number }) {
  const cell = (caption: string, value: React.ReactNode, valueColor: string, big = true) => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontSize: 8, color: '#475569', letterSpacing: '0.1em' }}>{caption}</span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span style={{
          fontSize: big ? 19 : 13, fontWeight: big ? 800 : 600,
          color: valueColor, fontFamily: 'JetBrains Mono, monospace',
        }}>{value}</span>
        {big && <span style={{ fontSize: 10, color: '#475569' }}>mil</span>}
      </div>
    </div>
  );
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      padding: '7px 10px', borderRadius: 6,
      background: '#0d1219', border: `1px solid ${color}33`,
    }}>
      <span style={{ fontSize: 12, fontWeight: 800, color, fontFamily: 'JetBrains Mono, monospace', width: 40 }}>
        {label}
      </span>
      {az !== undefined && cell('АЗИМУТ', formatMils(az, mils), '#22c55e')}
      {cell('ВОЗВЫШ.', elev, color)}
      {tof != null && (
        <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 'auto' }}>
          <span style={{ fontSize: 8, color: '#475569', letterSpacing: '0.1em' }}>TOF</span>
          <span style={{ fontSize: 13, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>
            {tof.toFixed(1)}с
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Per-angle wind correction (howitzer) ────────────────────────────────────

function WindBadgeHow({ sol }: { sol: FireSolution }) {
  const row = (label: string, color: string, az?: number, r?: number) => {
    if (az == null && r == null) return null;
    return (
      <span style={{ fontSize: 10, color: '#7dd3fc', fontFamily: 'JetBrains Mono, monospace' }}>
        <span style={{ color, fontWeight: 700 }}>{label}</span>{' '}
        Az {(az ?? 0) > 0 ? '+' : ''}{az ?? 0} · Д {(r ?? 0) > 0 ? '+' : ''}{r ?? 0}м
      </span>
    );
  };
  return (
    <div style={{
      display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6, alignItems: 'center',
      padding: '4px 8px', borderRadius: 4, background: '#0c4a6e20', border: '1px solid #0c4a6e',
    }}>
      <span style={{ fontSize: 9, color: '#38bdf8', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.05em' }}>
        ПОПРАВКА ВЕТЕР
      </span>
      {sol.elevationLow  !== undefined && row('LOW',  '#38bdf8', sol.windAzDeltaLow,  sol.windRangeDeltaLow)}
      {sol.elevationHigh !== undefined && row('HIGH', '#c084fc', sol.windAzDeltaHigh, sol.windRangeDeltaHigh)}
    </div>
  );
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

  // Howitzer: wind splits LOW/HIGH azimuth — show each trajectory's own bearing.
  const perAngleAz = !isMortar
    && fireSolution.azimuthMilsLow  != null
    && fireSolution.azimuthMilsHigh != null
    && fireSolution.azimuthMilsLow !== fireSolution.azimuthMilsHigh;
  const howWind = !isMortar && (
    fireSolution.windAzDeltaLow    != null || fireSolution.windRangeDeltaLow  != null ||
    fireSolution.windAzDeltaHigh   != null || fireSolution.windRangeDeltaHigh != null);

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
            <span className="sol-label">Азимут{perAngleAz ? ' · база' : ''}</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, flexWrap: 'wrap' }}>
              <span className="sol-value-xl">{formatMils(fireSolution.azimuthMils, mils)}</span>
              <span className="sol-unit" style={{ fontSize: 14 }}>mil</span>
              <DegBadge value={fireSolution.azimuthMils} mpc={mils} />
            </div>
            {perAngleAz && (
              <span style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>
                ветер разводит LOW/HIGH — азимут ниже
              </span>
            )}
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
        <>
        {/* Charge + dispersion summary */}
        {(fireSolution.chargeLevel !== undefined || fireSolution.dispersion !== undefined) && (
          <div className="flex gap-4 flex-wrap" style={{ marginBottom: 8 }}>
            {fireSolution.chargeLevel !== undefined && (
              <div className="sol-block">
                <span className="sol-label" style={{ color: '#c084fc' }}>Заряд</span>
                <span className="sol-value-md" style={{ color: '#c084fc' }}>
                  {fireSolution.chargeLevel}
                </span>
              </div>
            )}
            {fireSolution.dispersion !== undefined && (
              <div className="sol-block">
                <span className="sol-label">Разброс</span>
                <span className="sol-value-sm" style={{ color: '#94a3b8' }}>
                  {fireSolution.dispersion} <span className="sol-unit">м</span>
                </span>
              </div>
            )}
          </div>
        )}

        {/* Per-trajectory solutions (each carries its own wind-corrected azimuth) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {fireSolution.elevationLow !== undefined && (
            <TrajRow
              label="LOW" color="#38bdf8" mils={mils}
              az={perAngleAz ? fireSolution.azimuthMilsLow : undefined}
              elev={fireSolution.elevationLow}
              tof={fireSolution.tofLow ?? undefined}
            />
          )}
          {fireSolution.elevationHigh !== undefined && (
            <TrajRow
              label="HIGH" color="#c084fc" mils={mils}
              az={perAngleAz ? fireSolution.azimuthMilsHigh : undefined}
              elev={fireSolution.elevationHigh}
              tof={fireSolution.tofHigh ?? undefined}
            />
          )}
        </div>

        {/* Per-angle wind correction */}
        {howWind && <WindBadgeHow sol={fireSolution} />}
        </>
      )}
    </div>
  );
}
