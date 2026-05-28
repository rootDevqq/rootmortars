import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import {
  coordsToGrid, formatGrid, gridToCoords,
  type GridPrecision,
} from '../utils/grid';

// ─── Numpad direction labels ──────────────────────────────────────────────────

const NUMPAD_KEYS = [
  { key: 7, label: '↖', title: 'СЗ' },
  { key: 8, label: '↑', title: 'С' },
  { key: 9, label: '↗', title: 'СВ' },
  { key: 4, label: '←', title: 'З' },
  { key: 5, label: '·', title: 'Центр (без смещения)' },
  { key: 6, label: '→', title: 'В' },
  { key: 1, label: '↙', title: 'ЮЗ' },
  { key: 2, label: '↓', title: 'Ю' },
  { key: 3, label: '↘', title: 'ЮВ' },
];

const STEP_OPTIONS = [10, 25, 50, 100, 200, 500];
const PRECISIONS: GridPrecision[] = [4, 6, 8];

// ─── Component ────────────────────────────────────────────────────────────────

export function TargetInput() {
  const {
    targetPos, setTargetPos,
    numpadStep, setNumpadStep,
    correctionRange, correctionAz,
    setCorrectionRange, setCorrectionAz,
    applyNumpad, applyFire,
    resetCorrection, recalculate,
  } = useAppStore();

  const [precision, setPrecision] = useState<GridPrecision>(6);
  const [gridInput, setGridInput] = useState('');
  const [gridError, setGridError] = useState('');

  const hasTarget = targetPos.x !== '' && targetPos.y !== '';

  const currentGrid = hasTarget
    ? formatGrid(coordsToGrid(Number(targetPos.x), Number(targetPos.y), precision))
    : null;

  const applyGridInput = () => {
    const res = gridToCoords(gridInput);
    if (!res.ok) { setGridError(res.error); return; }
    setTargetPos('x', res.x);
    setTargetPos('y', res.y);
    setGridInput('');
    setGridError('');
  };

  const copyGrid = () => {
    if (currentGrid) navigator.clipboard?.writeText(`GRID ${currentGrid}`).catch(() => {});
  };

  return (
    <div className="card p-3 flex flex-col gap-3">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <span className="section-label mb-0" style={{ color: '#ef4444' }}>
          ✕ Цель
        </span>
      </div>

      {/* ── GRID input ── */}
      <div style={{
        background: '#0d1219', border: '1px solid #1e2a3a', borderRadius: 6,
        padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        {/* Row 1: label + precision + current grid display */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#ef444480', textTransform: 'uppercase' }}>
            GRID
          </span>
          {/* Precision picker */}
          <div style={{ display: 'flex', gap: 2 }}>
            {PRECISIONS.map(p => (
              <button
                key={p}
                onClick={() => setPrecision(p)}
                style={{
                  padding: '1px 5px', fontSize: 9, borderRadius: 3,
                  fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
                  cursor: 'pointer', border: `1px solid ${precision === p ? '#ef4444' : '#1e2a3a'}`,
                  background: precision === p ? '#7f1d1d40' : 'transparent',
                  color: precision === p ? '#f87171' : '#334155',
                }}
              >
                {p}d
              </button>
            ))}
          </div>
          {/* Current target as grid */}
          {currentGrid && (
            <div className="flex items-center gap-2">
              <span style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 13, fontWeight: 700, color: '#ef4444',
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
            </div>
          )}
        </div>

        {/* Row 2: Grid text input */}
        <div className="flex gap-2">
          <input
            type="text"
            className="input-sm"
            style={{ flex: 1, letterSpacing: '0.05em' }}
            placeholder="053032  или  053-032  или  05310327"
            value={gridInput}
            onChange={e => { setGridInput(e.target.value); setGridError(''); }}
            onKeyDown={e => { if (e.key === 'Enter') applyGridInput(); }}
          />
          <button
            className="btn-secondary"
            style={{ fontSize: 11, padding: '4px 10px', flexShrink: 0 }}
            onClick={applyGridInput}
          >
            → XY
          </button>
        </div>
        {gridError && (
          <div style={{ fontSize: 10, color: '#f87171' }}>{gridError}</div>
        )}
        <div style={{ fontSize: 9, color: '#334155' }}>
          4 знака = 1000м · 6 = 100м · 8 = 10м точность
        </div>
      </div>

      {/* ── X / Y / H inputs ── */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="field-label" style={{ color: '#ef4444' }}>X (восток)</label>
          <input
            type="number" className="input" value={targetPos.x} placeholder="4478"
            onChange={e => setTargetPos('x', e.target.value === '' ? '' : Number(e.target.value))}
          />
        </div>
        <div>
          <label className="field-label" style={{ color: '#ef4444' }}>Y (север)</label>
          <input
            type="number" className="input" value={targetPos.y} placeholder="661"
            onChange={e => setTargetPos('y', e.target.value === '' ? '' : Number(e.target.value))}
          />
        </div>
        <div>
          <label className="field-label" style={{ color: '#ef4444' }}>H (высота)</label>
          <input
            type="number" className="input" value={targetPos.h} placeholder="116"
            onChange={e => setTargetPos('h', e.target.value === '' ? '' : Number(e.target.value))}
          />
        </div>
      </div>

      {/* ── Calculate button ── */}
      <button className="btn-fire" onClick={recalculate}>
        РАССЧИТАТЬ
      </button>

      {/* ── Numpad section ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="section-label mb-0">Смещение цели</span>
          <div className="flex items-center gap-1">
            <span className="field-label mb-0 mr-1">Шаг:</span>
            {STEP_OPTIONS.map(s => (
              <button
                key={s}
                onClick={() => setNumpadStep(s)}
                style={{
                  padding: '2px 6px', fontSize: 10,
                  fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
                  borderRadius: 4, cursor: 'pointer',
                  border: `1px solid ${numpadStep === s ? '#38bdf8' : '#1e2a3a'}`,
                  background: numpadStep === s ? '#0c4a6e40' : 'transparent',
                  color: numpadStep === s ? '#38bdf8' : '#475569',
                  transition: 'all 0.1s',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, maxWidth: 180 }}>
          {NUMPAD_KEYS.map(({ key, label, title }) =>
            key === 5 ? (
              <div key={key} className="numpad-center" title={title} style={{ fontSize: 9 }}>
                {numpadStep}м
              </div>
            ) : (
              <button
                key={key}
                className="numpad-btn"
                title={`${title} +${numpadStep}м`}
                onClick={() => { if (hasTarget) applyNumpad(key); }}
                disabled={!hasTarget}
                style={{ opacity: hasTarget ? 1 : 0.35 }}
              >
                {label}
              </button>
            )
          )}
        </div>
      </div>

      {/* ── Correction panel ── */}
      <div className="card-inner p-2.5 flex flex-col gap-2">
        <span className="section-label mb-0">Корректура</span>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="field-label">Дальность (м)</label>
            <input
              type="number" className="correction-input input"
              placeholder="+50 / -50"
              value={correctionRange || ''}
              onChange={e => setCorrectionRange(e.target.value === '' ? 0 : Number(e.target.value))}
            />
          </div>
          <div>
            <label className="field-label">Азимут (mil)</label>
            <input
              type="number" className="correction-input input"
              placeholder="+5 / -5"
              value={correctionAz || ''}
              onChange={e => setCorrectionAz(e.target.value === '' ? 0 : Number(e.target.value))}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-primary"
            style={{ flex: 1, fontSize: 11 }}
            onClick={applyFire}
            disabled={!hasTarget}
          >
            Применить
          </button>
          <button
            className="btn-ghost"
            style={{ fontSize: 11, padding: '5px 10px' }}
            onClick={resetCorrection}
          >
            Сброс
          </button>
        </div>
      </div>
    </div>
  );
}
