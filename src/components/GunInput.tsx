import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import {
  coordsToGrid, formatGrid, gridToCoords,
  type GridPrecision,
} from '../utils/grid';

// ─── Precision selector ───────────────────────────────────────────────────────

const PRECISIONS: GridPrecision[] = [4, 6, 8];

function PrecisionPicker({
  value, onChange,
}: {
  value: GridPrecision;
  onChange: (p: GridPrecision) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {PRECISIONS.map(p => (
        <button
          key={p}
          onClick={() => onChange(p)}
          style={{
            padding: '1px 5px', fontSize: 9, borderRadius: 3,
            fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
            cursor: 'pointer', border: `1px solid ${value === p ? '#f59e0b' : '#1e2a3a'}`,
            background: value === p ? '#78350f40' : 'transparent',
            color: value === p ? '#f59e0b' : '#334155',
          }}
        >
          {p}d
        </button>
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GunInput() {
  const {
    gunPos, setGunPos,
    savedGuns, selectedMapId,
    loadGunAsPosition, addGun,
  } = useAppStore();

  const [precision, setPrecision]   = useState<GridPrecision>(6);
  const [gridInput, setGridInput]   = useState('');
  const [gridError, setGridError]   = useState('');
  const [showGridIn, setShowGridIn] = useState(false);

  const mapGuns = savedGuns.filter(g => !selectedMapId || g.mapId === selectedMapId);
  const hasPos  = gunPos.x !== '' && gunPos.y !== '';

  const currentGrid = hasPos
    ? formatGrid(coordsToGrid(Number(gunPos.x), Number(gunPos.y), precision))
    : null;

  const saveCurrentPos = () => {
    if (!hasPos) return;
    const name = `Позиция ${new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}`;
    addGun({
      name, mapId: selectedMapId,
      x: Number(gunPos.x), y: Number(gunPos.y), h: Number(gunPos.h) || 0,
    });
  };

  const applyGridInput = () => {
    const res = gridToCoords(gridInput);
    if (!res.ok) { setGridError(res.error); return; }
    setGunPos('x', res.x);
    setGunPos('y', res.y);
    setGridInput('');
    setGridError('');
    setShowGridIn(false);
  };

  const copyGrid = () => {
    if (currentGrid) navigator.clipboard?.writeText(`GRID ${currentGrid}`).catch(() => {});
  };

  return (
    <div className="card p-3 flex flex-col gap-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="section-label mb-0" style={{ color: '#f59e0b' }}>
          ▲ Огневая позиция
        </span>
        <div className="flex gap-1.5">
          {hasPos && (
            <button
              className="btn-ghost"
              style={{ fontSize: 10, padding: '3px 8px' }}
              onClick={saveCurrentPos}
              title="Сохранить текущую позицию"
            >
              💾
            </button>
          )}
        </div>
      </div>

      {/* Saved guns quick-load */}
      {mapGuns.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {mapGuns.map(g => (
            <button
              key={g.id}
              className="btn-secondary"
              style={{ fontSize: 11, padding: '3px 8px' }}
              onClick={() => loadGunAsPosition(g)}
              title={`X:${g.x} Y:${g.y} H:${g.h}`}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      {/* X / Y / H */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="field-label" style={{ color: '#f59e0b' }}>X (восток)</label>
          <input type="number" className="input" value={gunPos.x} placeholder="4478"
            onChange={e => setGunPos('x', e.target.value === '' ? '' : Number(e.target.value))} />
        </div>
        <div>
          <label className="field-label" style={{ color: '#f59e0b' }}>Y (север)</label>
          <input type="number" className="input" value={gunPos.y} placeholder="661"
            onChange={e => setGunPos('y', e.target.value === '' ? '' : Number(e.target.value))} />
        </div>
        <div>
          <label className="field-label" style={{ color: '#f59e0b' }}>H (высота)</label>
          <input type="number" className="input" value={gunPos.h} placeholder="116"
            onChange={e => setGunPos('h', e.target.value === '' ? '' : Number(e.target.value))} />
        </div>
      </div>

      {/* GRID display + input toggle */}
      <div style={{ borderTop: '1px solid #1e2a3a', paddingTop: 8 }}>
        <div className="flex items-center justify-between gap-2">
          {/* Left: current GRID or placeholder */}
          <div className="flex items-center gap-6">
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: '#475569', textTransform: 'uppercase' }}>
              GRID
            </span>
            {currentGrid ? (
              <span style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 14, fontWeight: 700, color: '#f59e0b',
                letterSpacing: '0.04em',
              }}>
                {currentGrid}
              </span>
            ) : (
              <span style={{ fontSize: 11, color: '#334155' }}>—</span>
            )}
          </div>

          {/* Right: precision + copy + toggle input */}
          <div className="flex items-center gap-2">
            <PrecisionPicker value={precision} onChange={setPrecision} />
            {currentGrid && (
              <button
                className="btn-ghost"
                style={{ fontSize: 9, padding: '2px 6px' }}
                onClick={copyGrid}
                title="Скопировать GRID"
              >
                COPY
              </button>
            )}
            <button
              className="btn-ghost"
              style={{ fontSize: 9, padding: '2px 6px', color: showGridIn ? '#22c55e' : undefined }}
              onClick={() => { setShowGridIn(v => !v); setGridError(''); }}
              title="Ввести позицию как GRID"
            >
              {showGridIn ? '▲' : '↓ ввести'}
            </button>
          </div>
        </div>

        {/* Grid input row */}
        {showGridIn && (
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div className="flex gap-2">
              <input
                type="text"
                className="input-sm"
                style={{ flex: 1, letterSpacing: '0.05em' }}
                placeholder="053032  или  053-032  или  05310327"
                value={gridInput}
                autoFocus
                onChange={e => { setGridInput(e.target.value); setGridError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') applyGridInput(); }}
              />
              <button
                className="btn-primary"
                style={{ fontSize: 11, padding: '4px 10px', flexShrink: 0 }}
                onClick={applyGridInput}
              >
                →
              </button>
            </div>
            {gridError && (
              <div style={{ fontSize: 10, color: '#f87171' }}>{gridError}</div>
            )}
            <div style={{ fontSize: 9, color: '#334155' }}>
              4 знака = 1000м · 6 знаков = 100м · 8 знаков = 10м точность
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
