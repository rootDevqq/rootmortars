import { useAppStore } from '../store/appStore';

// ─── Wind rose arrow ──────────────────────────────────────────────────────────
// Shows FROM which direction wind blows (matches Arma 1.7 Метеосводка)

function WindArrow({ dir, speed }: { dir: number; speed: number }) {
  const cx = 28, cy = 28, R = 20;
  // Arrow points FROM wind origin TO center (wind is blowing inward)
  const rad = (dir - 90) * (Math.PI / 180);
  const ox = cx + R * Math.cos(rad);
  const oy = cy + R * Math.sin(rad);

  const color = speed === 0 ? '#334155' : speed < 5 ? '#22c55e' : speed < 10 ? '#eab308' : '#ef4444';

  return (
    <svg width="56" height="56" viewBox="0 0 56 56" style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={26} fill="none" stroke="#1e2a3a" strokeWidth="1" />
      <circle cx={cx} cy={cy} r={3} fill="#263448" />
      {/* Cardinal labels */}
      {[['С', 28, 6], ['Ю', 28, 53], ['З', 5, 31], ['В', 51, 31]].map(([l, x, y]) => (
        <text key={l as string} x={x as number} y={y as number} textAnchor="middle"
          fontSize="7" fontFamily="JetBrains Mono, monospace" fill="#334155">{l}</text>
      ))}
      {speed > 0 && (
        <>
          {/* Arrow from source toward center */}
          <line
            x1={ox} y1={oy} x2={cx} y2={cy}
            stroke={color} strokeWidth="2" strokeLinecap="round"
          />
          {/* Arrowhead at center end */}
          <circle cx={cx} cy={cy} r="3.5" fill={color} />
          {/* Origin dot */}
          <circle cx={ox} cy={oy} r="2.5" fill={color} opacity="0.6" />
        </>
      )}
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WindInput() {
  const { windSpeed, windDir, setWindSpeed, setWindDir, windDb } = useAppStore();

  const hasWindData = windDb !== null;
  const speedColor = windSpeed === 0 ? '#475569' : windSpeed < 5 ? '#22c55e' : windSpeed < 10 ? '#eab308' : '#ef4444';

  const nudgeSpeed = (delta: number) => setWindSpeed(Math.max(0, Math.min(20, windSpeed + delta)));
  const nudgeDir   = (delta: number) => setWindDir(windDir + delta);

  return (
    <div className="card p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="section-label mb-0" style={{ color: '#38bdf8' }}>
          ≋ Ветер
        </span>
        {!hasWindData && (
          <span style={{ fontSize: 9, color: '#475569' }}>нет таблиц</span>
        )}
        {windSpeed > 0 && hasWindData && (
          <span style={{ fontSize: 9, color: '#22c55e', fontFamily: 'JetBrains Mono', fontWeight: 700 }}>
            АКТИВЕН
          </span>
        )}
      </div>

      <div className="flex gap-3 items-center">
        {/* Wind rose */}
        <WindArrow dir={windDir} speed={windSpeed} />

        {/* Controls */}
        <div className="flex-1 flex flex-col gap-2">

          {/* Speed row */}
          <div className="flex items-center gap-1">
            <span style={{ fontSize: 10, color: '#475569', width: 44, flexShrink: 0 }}>скор.</span>
            <button
              onClick={() => nudgeSpeed(-1)}
              style={{ width: 22, height: 22, borderRadius: 4, fontSize: 14, cursor: 'pointer',
                border: '1px solid #1e2a3a', background: 'transparent', color: '#475569',
                display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
            >−</button>
            <input
              type="number" min={0} max={20} step={1}
              value={windSpeed}
              onChange={e => setWindSpeed(Number(e.target.value) || 0)}
              style={{
                width: 44, textAlign: 'center', background: '#0d1219', border: '1px solid #1e2a3a',
                borderRadius: 4, color: speedColor, fontFamily: 'JetBrains Mono, monospace',
                fontWeight: 700, fontSize: 14, padding: '2px 4px',
              }}
            />
            <button
              onClick={() => nudgeSpeed(+1)}
              style={{ width: 22, height: 22, borderRadius: 4, fontSize: 14, cursor: 'pointer',
                border: '1px solid #1e2a3a', background: 'transparent', color: '#475569',
                display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
            >+</button>
            <span style={{ fontSize: 10, color: '#334155', marginLeft: 2 }}>м/с</span>
          </div>

          {/* Direction row */}
          <div className="flex items-center gap-1">
            <span style={{ fontSize: 10, color: '#475569', width: 44, flexShrink: 0 }}>откуда</span>
            <button
              onClick={() => nudgeDir(-5)}
              style={{ width: 22, height: 22, borderRadius: 4, fontSize: 11, cursor: 'pointer',
                border: '1px solid #1e2a3a', background: 'transparent', color: '#475569',
                display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
            >−5</button>
            <input
              type="number" min={0} max={359} step={1}
              value={windDir}
              onChange={e => setWindDir(Number(e.target.value) || 0)}
              style={{
                width: 44, textAlign: 'center', background: '#0d1219', border: '1px solid #38bdf820',
                borderRadius: 4, color: '#38bdf8', fontFamily: 'JetBrains Mono, monospace',
                fontWeight: 700, fontSize: 14, padding: '2px 4px',
              }}
            />
            <button
              onClick={() => nudgeDir(+5)}
              style={{ width: 22, height: 22, borderRadius: 4, fontSize: 11, cursor: 'pointer',
                border: '1px solid #1e2a3a', background: 'transparent', color: '#475569',
                display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
            >+5</button>
            <span style={{ fontSize: 10, color: '#334155', marginLeft: 2 }}>°</span>
          </div>

        </div>

        {/* Reset button */}
        {windSpeed > 0 && (
          <button
            onClick={() => setWindSpeed(0)}
            style={{
              fontSize: 9, padding: '4px 7px', borderRadius: 4, cursor: 'pointer',
              border: '1px solid #1e2a3a', background: 'transparent', color: '#475569',
              fontFamily: 'JetBrains Mono', alignSelf: 'center', flexShrink: 0,
            }}
          >
            СБРОС
          </button>
        )}
      </div>

      {/* Help text */}
      <div style={{ fontSize: 9, color: '#263448', marginTop: 4 }}>
        Направление = откуда дует (как в Метеосводке)
      </div>
    </div>
  );
}
