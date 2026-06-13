import { useState, useEffect, useRef } from 'react';
import { coordsToGrid, formatGrid, gridToCoords, type GridPrecision } from '../utils/grid';

// ─── SVG mini-map refinement ──────────────────────────────────────────────────
// Represents a 100×100m square. Click or drag to place a marker.
// Local coords: X=east (0-99), Y=north (0-99), SW corner = (0,0)
// Optional: load a screenshot of the cell, drag a square over it to zoom-to-fit,
// then click directly on terrain features.

const MAP_SIZE = 256; // SVG square side, px

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
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef  = useRef<SVGSVGElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Optional reference screenshot. The image is pan/zoom-transformed so the
  // 100×100m cell fills the whole frame; the marker mapping stays frame = cell.
  const [imgUrl, setImgUrl]           = useState<string | null>(null);
  const [imgT, setImgT]               = useState({ sx: 1, sy: 1, tx: 0, ty: 0 });
  const [calibrating, setCalibrating] = useState(false);
  const [dragRect, setDragRect]       = useState<{ x: number; y: number; s: number } | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  // local meters (0..100, X=east, Y=north) ↔ frame px (Y flipped, north=top)
  const toSvg = (mx: number, my: number) => ({ x: (mx / 100) * MAP_SIZE, y: (1 - my / 100) * MAP_SIZE });
  const placeMarker = (px: number, py: number) => {
    setLx(Math.max(0, Math.min(99, Math.round((px / MAP_SIZE) * 100))));
    setLy(Math.max(0, Math.min(99, Math.round((1 - py / MAP_SIZE) * 100))));
  };

  // ── image loading: file / drop / clipboard paste ──
  const loadFile = (file?: File | null) => {
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    setImgUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
    setImgT({ sx: 1, sy: 1, tx: 0, ty: 0 });
    setCalibrating(true);     // load → straight into "draw the square"
  };
  useEffect(() => () => { if (imgUrl) URL.revokeObjectURL(imgUrl); }, [imgUrl]);
  // Focus this panel so Ctrl+V lands here only (not into other open refine panels).
  useEffect(() => { rootRef.current?.focus({ preventScroll: true }); }, []);
  const onPaste = (e: React.ClipboardEvent) => {
    const img = Array.from(e.clipboardData?.items ?? []).find(it => it.type.startsWith('image/'));
    if (img) { loadFile(img.getAsFile()); e.preventDefault(); }
  };

  // ── pointer: draw the calibration square, or place/drag the marker ──
  const isDragging = useRef(false);
  const ptr = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { px: e.clientX - r.left, py: e.clientY - r.top };
  };
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.preventDefault();
    rootRef.current?.focus({ preventScroll: true });
    svgRef.current?.setPointerCapture(e.pointerId);
    const { px, py } = ptr(e);
    if (calibrating) {
      dragStart.current = { x: px, y: py };
      setDragRect({ x: px, y: py, s: 0 });
    } else {
      isDragging.current = true;
      placeMarker(px, py);
    }
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const { px, py } = ptr(e);
    if (calibrating && dragStart.current) {
      const dx = px - dragStart.current.x, dy = py - dragStart.current.y;
      const s = Math.max(Math.abs(dx), Math.abs(dy));   // square selection (cell is square)
      setDragRect({
        x: dx < 0 ? dragStart.current.x - s : dragStart.current.x,
        y: dy < 0 ? dragStart.current.y - s : dragStart.current.y,
        s,
      });
    } else if (isDragging.current) {
      placeMarker(px, py);
    }
  };
  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    svgRef.current?.releasePointerCapture(e.pointerId);
    if (calibrating && dragRect && dragRect.s >= 8) {
      // Zoom so the drawn square fills the whole frame (uniform → no distortion).
      const k = MAP_SIZE / dragRect.s;
      setImgT(t => ({ sx: t.sx * k, sy: t.sy * k, tx: (t.tx - dragRect.x) * k, ty: (t.ty - dragRect.y) * k }));
      setCalibrating(false);
    }
    dragStart.current = null;
    setDragRect(null);
    isDragging.current = false;
  };

  const dot = toSvg(lx, ly);
  const apply = () => { onApply(baseX + lx, baseY + ly); onClose(); };

  const btnSm: React.CSSProperties = {
    fontSize: 9, padding: '4px 6px', borderRadius: 4, cursor: 'pointer',
    border: `1px solid ${accentColor}40`, background: 'transparent', color: accentColor,
    fontFamily: 'JetBrains Mono', whiteSpace: 'nowrap',
  };
  const numInput: React.CSSProperties = {
    width: '100%', background: '#0d1219', border: `1px solid ${accentColor}40`,
    borderRadius: 4, color: accentColor, fontFamily: 'JetBrains Mono',
    fontWeight: 700, fontSize: 14, padding: '3px 5px', textAlign: 'center',
  };

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onPaste={onPaste}
      style={{
        background: '#0a0e14', border: `1px solid ${accentColor}40`,
        borderRadius: 6, padding: 10, display: 'flex', flexDirection: 'column', gap: 8,
        outline: 'none',
      }}
    >
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

      {/* Mini-map (top, centered, full width of panel) */}
      <div style={{ alignSelf: 'center', maxWidth: '100%' }}>
        <div style={{ textAlign: 'center', fontSize: 8, color: '#475569', marginBottom: 2 }}>С↑</div>
        <svg
          ref={svgRef}
          width={MAP_SIZE} height={MAP_SIZE}
          style={{ cursor: 'crosshair', display: 'block', borderRadius: 3, userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none', maxWidth: '100%' } as React.CSSProperties}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); loadFile(e.dataTransfer.files?.[0]); }}
        >
          {/* Background + optional screenshot (transformed; clipped to svg viewport) */}
          <rect x={0} y={0} width={MAP_SIZE} height={MAP_SIZE} fill="#0d1219" />
          {imgUrl && (
            <g transform={`translate(${imgT.tx} ${imgT.ty}) scale(${imgT.sx} ${imgT.sy})`}>
              <image href={imgUrl} x={0} y={0} width={MAP_SIZE} height={MAP_SIZE} preserveAspectRatio="xMidYMid meet" />
            </g>
          )}

          {/* 25m grid */}
          {[25, 50, 75].map(v => {
            const a = toSvg(v, 0), b = toSvg(v, 100), p = toSvg(0, v), q = toSvg(100, v);
            return (
              <g key={v}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={accentColor} strokeOpacity={imgUrl ? 0.3 : 0.12} strokeWidth={0.8} />
                <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={accentColor} strokeOpacity={imgUrl ? 0.3 : 0.12} strokeWidth={0.8} />
              </g>
            );
          })}

          {/* Border */}
          <rect x={0.5} y={0.5} width={MAP_SIZE - 1} height={MAP_SIZE - 1} fill="none" stroke={accentColor} strokeOpacity={0.5} strokeWidth={1} />

          {/* Corner labels */}
          <text x={3} y={MAP_SIZE - 4} fontSize={8} fill="#475569" fontFamily="JetBrains Mono">0/0</text>
          <text x={MAP_SIZE - 34} y={11} fontSize={8} fill="#475569" fontFamily="JetBrains Mono">99/99</text>

          {/* Live calibration square */}
          {dragRect && (
            <rect x={dragRect.x} y={dragRect.y} width={dragRect.s} height={dragRect.s}
              fill="#fde04722" stroke="#fde047" strokeWidth={1.5} strokeDasharray="5 3" />
          )}

          {/* Marker (hidden while calibrating) */}
          {!calibrating && (() => {
            const t = toSvg(lx, 0), bm = toSvg(lx, 100), lft = toSvg(0, ly), rgt = toSvg(100, ly);
            return (
              <>
                <line x1={t.x} y1={t.y} x2={bm.x} y2={bm.y} stroke={accentColor} strokeWidth={0.7} strokeOpacity={0.5} strokeDasharray="3 3" />
                <line x1={lft.x} y1={lft.y} x2={rgt.x} y2={rgt.y} stroke={accentColor} strokeWidth={0.7} strokeOpacity={0.5} strokeDasharray="3 3" />
                <circle cx={dot.x} cy={dot.y} r={6} fill={accentColor} stroke="#0d1219" strokeWidth={1.5} />
                <circle cx={dot.x} cy={dot.y} r={2.2} fill="#fff" />
              </>
            );
          })()}
        </svg>
        <div style={{ textAlign: 'right', fontSize: 8, color: '#475569', marginTop: 2 }}>→В</div>

        {/* Screenshot controls */}
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => { loadFile(e.target.files?.[0]); e.target.value = ''; }} />
        {!imgUrl ? (
          <button onClick={() => fileRef.current?.click()} style={{ ...btnSm, width: '100%', marginTop: 6 }}>
            📷 Скрин квадрата · вставь Ctrl+V
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
            <button onClick={() => { setImgT({ sx: 1, sy: 1, tx: 0, ty: 0 }); setCalibrating(true); }} style={{ ...btnSm, flex: 1 }}>
              ⟲ Обвести квадрат
            </button>
            <button onClick={() => { setImgUrl(null); setCalibrating(false); setImgT({ sx: 1, sy: 1, tx: 0, ty: 0 }); }} style={{ ...btnSm, color: '#f87171', borderColor: '#7f1d1d' }}>
              ✕
            </button>
          </div>
        )}
        {calibrating && (
          <div style={{ fontSize: 9, color: '#fde047', marginTop: 4, lineHeight: 1.35, maxWidth: MAP_SIZE }}>
            Обведи клетку: зажми в одном её углу и тяни к противоположному — квадрат растянется на весь блок.
          </div>
        )}
      </div>

      {/* Inputs + result + buttons (full width) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
            <label style={{ fontSize: 8, color: '#475569' }}>+X (в)</label>
            <input type="number" min={0} max={99} step={1} value={lx}
              onChange={e => setLx(Math.max(0, Math.min(99, Number(e.target.value) || 0)))} style={numInput} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
            <label style={{ fontSize: 8, color: '#475569' }}>+Y (с)</label>
            <input type="number" min={0} max={99} step={1} value={ly}
              onChange={e => setLy(Math.max(0, Math.min(99, Number(e.target.value) || 0)))} style={numInput} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1.5, minWidth: 0 }}>
            <label style={{ fontSize: 8, color: '#475569' }}>Итог (X/Y)</label>
            <div style={{
              padding: '4px 6px', borderRadius: 4, background: `${accentColor}10`, border: `1px solid ${accentColor}30`,
              fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700, color: accentColor,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }} title={formatGrid(coordsToGrid(baseX + lx, baseY + ly, 8))}>
              {baseX + lx} / {baseY + ly}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={apply}
            style={{
              flex: 1, padding: '7px 4px', borderRadius: 4, cursor: 'pointer',
              fontSize: 11, fontFamily: 'JetBrains Mono', fontWeight: 700,
              background: `${accentColor}25`, border: `1px solid ${accentColor}60`, color: accentColor,
            }}
          >
            Принять
          </button>
          <button
            onClick={() => { setLx(50); setLy(50); }}
            style={{
              padding: '7px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 10,
              background: 'transparent', border: '1px solid #1e2a3a', color: '#475569', whiteSpace: 'nowrap',
            }}
          >
            Центр
          </button>
        </div>

        <div style={{ fontSize: 8, color: '#263448', lineHeight: 1.4 }}>
          Клик/тяни — метка. Загрузи скрин (Ctrl+V), обведи квадрат — он растянется, и кликай прямо по объектам.
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
