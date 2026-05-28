import { useAppStore } from '../store/appStore';
import { GridSection } from './GridSection';

export function GunInput() {
  const {
    gunPos, setGunPos,
    savedGuns, selectedMapId,
    loadGunAsPosition, addGun,
  } = useAppStore();

  const mapGuns = savedGuns.filter(g => !selectedMapId || g.mapId === selectedMapId);
  const hasPos  = gunPos.x !== '' && gunPos.y !== '';

  const saveCurrentPos = () => {
    if (!hasPos) return;
    const name = `Позиция ${new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}`;
    addGun({
      name, mapId: selectedMapId,
      x: Number(gunPos.x), y: Number(gunPos.y), h: Number(gunPos.h) || 0,
    });
  };

  return (
    <div className="card p-3 flex flex-col gap-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="section-label mb-0" style={{ color: '#f59e0b' }}>
          ▲ Огневая позиция
        </span>
        {hasPos && (
          <button
            className="btn-ghost"
            style={{ fontSize: 10, padding: '3px 8px' }}
            onClick={saveCurrentPos}
            title="Сохранить текущую позицию"
          >
            💾 Сохранить
          </button>
        )}
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

      {/* Grid section — same style as TargetInput */}
      <GridSection
        x={gunPos.x}
        y={gunPos.y}
        accentColor="#f59e0b"
        onSetXY={(x, y) => { setGunPos('x', x); setGunPos('y', y); }}
      />

      {/* X / Y / H inputs */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="field-label" style={{ color: '#f59e0b' }}>X (восток)</label>
          <input
            type="number" className="input" value={gunPos.x} placeholder="4478"
            onChange={e => setGunPos('x', e.target.value === '' ? '' : Number(e.target.value))}
          />
        </div>
        <div>
          <label className="field-label" style={{ color: '#f59e0b' }}>Y (север)</label>
          <input
            type="number" className="input" value={gunPos.y} placeholder="661"
            onChange={e => setGunPos('y', e.target.value === '' ? '' : Number(e.target.value))}
          />
        </div>
        <div>
          <label className="field-label" style={{ color: '#f59e0b' }}>H (высота)</label>
          <input
            type="number" className="input" value={gunPos.h} placeholder="116"
            onChange={e => setGunPos('h', e.target.value === '' ? '' : Number(e.target.value))}
          />
        </div>
      </div>

    </div>
  );
}
