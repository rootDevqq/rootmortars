import { useState, useEffect, useRef } from 'react';
import { coordsToGrid, formatGrid, gridToCoords, type GridPrecision } from '../utils/grid';

// ─── SVG mini-map refinement ──────────────────────────────────────────────────
// Represents a 100×100m square. Click or drag to place a marker.
// Local coords: X=east (0-99), Y=north (0-99), SW corner = (0,0)

const MAP_SIZE = 156; // SVG square side, px

interface RefineProps {
  baseX: number;
  baseY: number;
  currentX: number;
  currentY: number;
  accentColor: string;
  onApply: (x: number, y: number) => void;
  onClose: () => void;
}

function GridRefine({ baseX, baseY, currentX, currentY, accentColor, onApply, onClose }: RefineProps) {
  const initLX = Math.max(0, Math.min(99, currentX - baseX));
  const initLY = Math.max(0, Math.min(99, currentY - baseY));
  const [lx, setLx] = useState(initLX);
  const [ly, setLy] = useState(initLY);
  const svgRef = useRef<SVGSVGElement>(null);

  // Convert SVG pixel → local offset (0-99)
  const svgToLocal = (px: number, py: number) => ({
    lx: Math.max(0, Math.min(99, Math.round(px / MAP_SIZE * 99))),
    ly: Math.max(0, Math.min(99, Math.round((1 - py / MAP_SIZE) * 99))),
  });

  // Pointer events — supports both click and drag
  const isDragging = useRef(false);

  const updateFromEvent = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const { lx: nlx, ly: nly } = svgToLocal(e.clientX - rect.left, e.clientY - rect.top);
    setLx(nlx);
    setLy(nly);
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    isDragging.current = true;
    svgRef.current?.setPointerCapture(e.pointerId);
    updateFromEvent(e);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isDragging.current) updateFromEvent(e);
  };
  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    isDragging.current = false;
    svgRef.current?.releasePointerCapture(e.pointerId);
  };

  // Dot position in SVG coords (Y is flipped: north = top)
  const dotSvgX = (lx / 99) * MAP_SIZE;
  const dotSvgY = (1 - ly / 99) * MAP_SIZE;

  const apply = () => {
    onApply(baseX + lx, baseY + ly);
    onClose();
  };

  return (
    <div style={{
      background: '#0a0e14', border: `1px solid ${accentColor}40`,
      borderRadius: 6, padding: 10, display: 'flex', flexDirection: 'column', gap: 8,
    }}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 10, color: accentColor, fontWeight: 700, letterSpacing: '0.08em' }}>
          УТОЧНЕНИЕ ПОЗИЦИИ
        </span>
        <button
          onClick={onClose}
          style={{ fontSize: 10, color: '#475569', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          ✕
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>

        {/* SVG mini-map */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {/* North label */}
          <div style={{ textAlign: 'center', fontSize: 8, color: '#475569', marginBottom: 2 }}>С↑</div>
          <svg
            ref={svgRef}
            width={MAP_SIZE} height={MAP_SIZE}
            style={{ cursor: 'crosshair', display: 'block', borderRadius: 3, userSelect: 'none', WebkitUserSelect: 'none' } as React.CSSProperties}
            onPointerDown={e => { e.preventDefault(); onPointerDown(e); }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            {/* Background */}
            <rect x={0} y={0} width={MAP_SIZE} height={MAP_SIZE} fill="#0d1219" />

            {/* 25m grid lines */}
            {[25, 50, 75].map(v => {
              const pos = (v / 100) * MAP_SIZE;
              return (
                <g key={v}>
                  <line x1={pos}   y1={0}        x2={pos}        y2={MAP_SIZE} stroke="#1e2a3a" strokeWidth={0.8} />
                  <line x1={0}     y1={MAP_SIZE - pos} x2={MAP_SIZE} y2={MAP_SIZE - pos} stroke="#1e2a3a" strokeWidth={0.8} />
                </g>
              );
            })}

            {/* Border */}
            <rect x={0} y={0} width={MAP_SIZE} height={MAP_SIZE}
              fill="none" stroke={accentColor} strokeOpacity={0.35} strokeWidth={1} />

            {/* Corner coord labels */}
            <text x={3}          y={MAP_SIZE - 3} fontSize={7} fill="#334155" fontFamily="JetBrains Mono">0/0</text>
            <text x={MAP_SIZE-22} y={MAP_SIZE - 3} fontSize={7} fill="#334155" fontFamily="JetBrains Mono">99/0</text>
            <text x={3}          y={9}            fontSize={7} fill="#334155" fontFamily="JetBrains Mono">0/99</text>
            <text x={MAP_SIZE-28} y={9}            fontSize={7} fill="#334155" fontFamily="JetBrains Mono">99/99</text>

            {/* 25m labels on axes */}
            {[25, 50, 75].map(v => {
              const pos = (v / 100) * MAP_SIZE;
              return (
                <g key={v}>
                  <text x={pos + 2} y={MAP_SIZE - 3} fontSize={6} fill="#263448" fontFamily="JetBrains Mono">{v}</text>
                  <text x={2} y={MAP_SIZE - pos + 4} fontSize={6} fill="#263448" fontFamily="JetBrains Mono">{v}</text>
                </g>
              );
            })}

            {/* Crosshair through marker */}
            <line x1={dotSvgX} y1={0} x2={dotSvgX} y2={MAP_SIZE}
              stroke={accentColor} strokeWidth={0.6} strokeOpacity={0.45} strokeDasharray="3 3" />
            <line x1={0} y1={dotSvgY} x2={MAP_SIZE} y2={dotSvgY}
              stroke={accentColor} strokeWidth={0.6} strokeOpacity={0.45} strokeDasharray="3 3" />

            {/* Marker dot */}
            <circle cx={dotSvgX} cy={dotSvgY} r={5.5} fill={accentColor} stroke="#0d1219" strokeWidth={1.5} />
            <circle cx={dotSvgX} cy={dotSvgY} r={2}   fill="#fff" />
          </svg>
          {/* East label */}
          <div style={{ textAlign: 'right', fontSize: 8, color: '#475569', marginTop: 2 }}>→В</div>
        </div>

        {/* Right side: inputs + result + buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 0 }}>

          {/* Local offset inputs */}
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
              <label style={{ fontSize: 8, color: '#475569' }}>+X (в)</label>
              <input
                type="number" min={0} max={99} step={1}
                value={lx}
                onChange={e => setLx(Math.max(0, Math.min(99, Number(e.target.value) || 0)))}
                style={{
                  width: '100%', background: '#0d1219', border: `1px solid ${accentColor}40`,
                  borderRadius: 4, color: accentColor, fontFamily: 'JetBrains Mono',
                  fontWeight: 700, fontSize: 14, padding: '3px 5px', textAlign: 'center',
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
              <label style={{ fontSize: 8, color: '#475569' }}>+Y (с)</label>
              <input
                type="number" min={0} max={99} step={1}
                value={ly}
                onChange={e => setLy(Math.max(0, Math.min(99, Number(e.target.value) || 0)))}
                style={{
                  width: '100%', background: '#0d1219', border: `1px solid ${accentColor}40`,
                  borderRadius: 4, color: accentColor, fontFamily: 'JetBrains Mono',
                  fontWeight: 700, fontSize: 14, padding: '3px 5px', textAlign: 'center',
                }}
              />
            </div>
          </div>

          {/* Result preview */}
          <div style={{
            padding: '6px 8px', borderRadius: 4,
            background: `${accentColor}10`, border: `1px solid ${accentColor}30`,
          }}>
            <div style={{ fontSize: 8, color: '#475569', marginBottom: 2 }}>Итог:</div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700, color: accentColor }}>
              {baseX + lx} / {baseY + ly}
            </div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: '#475569', marginTop: 1 }}>
              {formatGrid(coordsToGrid(baseX + lx, baseY + ly, 8))}
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={apply}
              style={{
                flex: 1, padding: '6px 4px', borderRadius: 4, cursor: 'pointer',
                fontSize: 11, fontFamily: 'JetBrains Mono', fontWeight: 700,
                background: `${accentColor}25`, border: `1px solid ${accentColor}60`,
                color: accentColor,
              }}
            >
              Принять
            </button>
            <button
              onClick={() => { setLx(50); setLy(50); }}
              style={{
                padding: '6px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 10,
                background: 'transparent', border: '1px solid #1e2a3a', color: '#475569',
                whiteSpace: 'nowrap',
              }}
            >
              Центр
            </button>
          </div>

          <div style={{ fontSize: 8, color: '#263448' }}>
            Кликни или тяни маркер
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Shared Grid section ──────────────────────────────────────────────────────

interface GridSectionProps {
  x: number | '';
  y: number | '';
  accentColor: string;
  onSetXY: (x: number, y: number) => void;
}

export function GridSection({ x, y, accentColor, onSetXY }: GridSectionProps) {
  const [precision, setPrecision] = useState<GridPrecision>(6);
  const [gridInput, setGridInput] = useState('');
  const [gridError, setGridError] = useState('');
  const [refineBase, setRefineBase] = useState<{ x: number; y: number } | null>(null);

  const hasCoords = x !== '' && y !== '';
  const nx = Number(x), ny = Number(y);

  const currentGrid = hasCoords
    ? formatGrid(coordsToGrid(nx, ny, precision))
    : null;

  useEffect(() => {
    if (precision !== 6) setRefineBase(null);
  }, [precision]);

  const applyGrid = () => {
    const raw = gridInput.trim();
    if (!raw) return;
    const res = gridToCoords(raw);
    if (!res.ok) { setGridError(res.error); return; }
    setGridError('');
    setGridInput('');
    onSetXY(res.x, res.y);
    if (res.precision === 6) {
      setRefineBase({ x: res.x, y: res.y });
      setPrecision(6);
    } else {
      setRefineBase(null);
    }
  };

  const copyGrid = () => {
    if (currentGrid) navigator.clipboard?.writeText(`GRID ${currentGrid}`).catch(() => {});
  };

  const PRECISIONS: GridPrecision[] = [4, 6, 8];

  return (
    <div style={{
      background: '#0d1219', border: '1px solid #1e2a3a', borderRadius: 6,
      padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      {/* Row 1: label + precision + current grid */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: `${accentColor}80`, textTransform: 'uppercase' }}>
          GRID
        </span>
        <div className="flex items-center gap-2">
          <div style={{ display: 'flex', gap: 2 }}>
            {PRECISIONS.map(p => (
              <button
                key={p}
                onClick={() => setPrecision(p)}
                style={{
                  padding: '1px 5px', fontSize: 9, borderRadius: 3,
                  fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
                  cursor: 'pointer', border: `1px solid ${precision === p ? accentColor : '#1e2a3a'}`,
                  background: precision === p ? `${accentColor}20` : 'transparent',
                  color: precision === p ? accentColor : '#334155',
                }}
              >
                {p}d
              </button>
            ))}
          </div>
          {currentGrid ? (
            <div className="flex items-center gap-1">
              <span style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 13, fontWeight: 700, color: accentColor,
              }}>
                {currentGrid}
              </span>
              <button
                className="btn-ghost"
                style={{ fontSize: 9, padding: '1px 5px' }}
                onClick={copyGrid}
              >
                COPY
              </button>
              {/* Toggle refinement from current position */}
              <button
                onClick={() => {
                  if (refineBase) {
                    setRefineBase(null);
                  } else {
                    setRefineBase({
                      x: Math.floor(nx / 100) * 100,
                      y: Math.floor(ny / 100) * 100,
                    });
                    setPrecision(6);
                  }
                }}
                title={refineBase ? 'Закрыть уточнение' : 'Уточнить позицию'}
                style={{
                  fontSize: 10, padding: '1px 6px', borderRadius: 3, cursor: 'pointer',
                  border: `1px solid ${refineBase ? accentColor : '#1e2a3a'}`,
                  background: refineBase ? `${accentColor}20` : 'transparent',
                  color: refineBase ? accentColor : '#475569',
                  fontFamily: 'JetBrains Mono',
                }}
              >
                {refineBase ? '▲' : '⊕'}
              </button>
            </div>
          ) : (
            <span style={{ fontSize: 11, color: '#334155' }}>—</span>
          )}
        </div>
      </div>

      {/* Row 2: Grid text input */}
      <div className="flex gap-2">
        <input
          type="text"
          className="input-sm"
          style={{ flex: 1, letterSpacing: '0.05em' }}
          placeholder="053032 · 053-032 · 05310327"
          value={gridInput}
          onChange={e => { setGridInput(e.target.value); setGridError(''); }}
          onKeyDown={e => { if (e.key === 'Enter') applyGrid(); }}
        />
        <button
          className="btn-secondary"
          style={{ fontSize: 11, padding: '4px 10px', flexShrink: 0 }}
          onClick={applyGrid}
        >
          → XY
        </button>
      </div>
      {gridError && <div style={{ fontSize: 10, color: '#f87171' }}>{gridError}</div>}
      <div style={{ fontSize: 9, color: '#334155' }}>
        4 знака = 1000м · 6 = 100м · 8 = 10м
      </div>

      {/* Refinement — appears after 6-digit entry */}
      {refineBase && hasCoords && (
        <GridRefine
          baseX={refineBase.x}
          baseY={refineBase.y}
          currentX={nx}
          currentY={ny}
          accentColor={accentColor}
          onApply={(fx, fy) => { onSetXY(fx, fy); setPrecision(8); }}
          onClose={() => setRefineBase(null)}
        />
      )}
    </div>
  );
}
