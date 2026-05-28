import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import type { MapPoint } from '../types';
import {
  calculateFireSolution,
  formatMils,
  getMilsPerCircle,
} from '../utils/ballistics';

// ─── Shared point form fields ─────────────────────────────────────────────────

interface PointFormState {
  location: string;
  label:    string;
  x:        string;
  y:        string;
  h:        string;
  note:     string;
}

const emptyForm = (): PointFormState => ({
  location: '', label: '', x: '', y: '', h: '', note: '',
});

function PointForm({
  form,
  setForm,
  zones,
  locationMode,
  setLocationMode,
  onSave,
  onCancel,
  saveLabel = 'Сохранить',
}: {
  form:             PointFormState;
  setForm:          (f: PointFormState) => void;
  zones:            string[];
  locationMode:     'zone' | 'custom';
  setLocationMode:  (m: 'zone' | 'custom') => void;
  onSave:           () => void;
  onCancel:         () => void;
  saveLabel?:       string;
}) {
  const f = form;
  const set = (patch: Partial<PointFormState>) => setForm({ ...f, ...patch });

  return (
    <div className="card-inner p-3 flex flex-col gap-2 fade-in">
      {/* Zone + Label */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="field-label">Зона</label>
          {zones.length > 0 ? (
            <>
              <select
                className="input-sm select"
                value={locationMode === 'custom' ? '__custom__' : f.location}
                onChange={e => {
                  if (e.target.value === '__custom__') {
                    setLocationMode('custom');
                    set({ location: '' });
                  } else {
                    setLocationMode('zone');
                    set({ location: e.target.value });
                  }
                }}
              >
                <option value="">— Без зоны —</option>
                {zones.map(z => <option key={z} value={z}>{z}</option>)}
                <option value="__custom__">✏ Своя зона...</option>
              </select>
              {locationMode === 'custom' && (
                <input
                  className="input-sm" style={{ marginTop: 4 }}
                  placeholder="Введите зону" autoFocus
                  value={f.location}
                  onChange={e => set({ location: e.target.value })}
                />
              )}
            </>
          ) : (
            <input
              className="input-sm" placeholder="Казармы"
              value={f.location}
              onChange={e => set({ location: e.target.value })}
            />
          )}
        </div>
        <div>
          <label className="field-label">Метка *</label>
          <input
            className="input-sm" placeholder="Штаб"
            value={f.label}
            onChange={e => set({ label: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && onSave()}
          />
        </div>
      </div>

      {/* X / Y / H */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="field-label">X *</label>
          <input type="number" className="input-sm" placeholder="5319"
            value={f.x} onChange={e => set({ x: e.target.value })} />
        </div>
        <div>
          <label className="field-label">Y *</label>
          <input type="number" className="input-sm" placeholder="3278"
            value={f.y} onChange={e => set({ y: e.target.value })} />
        </div>
        <div>
          <label className="field-label">H</label>
          <input type="number" className="input-sm" placeholder="83"
            value={f.h} onChange={e => set({ h: e.target.value })} />
        </div>
      </div>

      {/* Note */}
      <div>
        <label className="field-label">Примечание</label>
        <input className="input-sm" placeholder="Необязательно"
          value={f.note} onChange={e => set({ note: e.target.value })} />
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <button className="btn-primary" style={{ fontSize: 11, flex: 1 }} onClick={onSave}>
          {saveLabel}
        </button>
        <button className="btn-ghost" style={{ fontSize: 11 }} onClick={onCancel}>
          Отмена
        </button>
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function PointsPanel() {
  const {
    points, selectedMapId, maps,
    weaponSystems, selectedWeaponId, selectedAmmoId, mortarMode, gunPos,
    addPoint, updatePoint, deletePoint, loadPointAsTarget,
    importPoints,
  } = useAppStore();

  const exportPoints = () => {
    const cleanPoints = mapPoints.map(({ id, mapId, ...rest }) => rest);
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cleanPoints, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `rootmortars_points_${currentMap?.names.en.toLowerCase() || 'export'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportPoints = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        importPoints(Array.isArray(parsed) ? parsed : [parsed]);
      } catch (err) {
        alert('Ошибка при чтении JSON-файла точек.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ── Add form ──
  const [showForm,      setShowForm]      = useState(false);
  const [addForm,       setAddForm]       = useState<PointFormState>(emptyForm());
  const [addLocMode,    setAddLocMode]    = useState<'zone' | 'custom'>('zone');

  // ── Edit form ──
  const [editId,        setEditId]        = useState<string | null>(null);
  const [editForm,      setEditForm]      = useState<PointFormState>(emptyForm());
  const [editLocMode,   setEditLocMode]   = useState<'zone' | 'custom'>('zone');

  const [searchQuery, setSearchQuery] = useState('');

  const currentMap = maps.find(m => m.id === selectedMapId);
  const zones      = currentMap?.permanentZones ?? [];

  const mapPoints = points.filter(p => !selectedMapId || p.mapId === selectedMapId);
  const filtered  = searchQuery
    ? mapPoints.filter(p =>
        p.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.location.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : mapPoints;

  const grouped = filtered.reduce<Record<string, MapPoint[]>>((acc, p) => {
    const loc = p.location || 'Без зоны';
    if (!acc[loc]) acc[loc] = [];
    acc[loc].push(p);
    return acc;
  }, {});

  const weapon = weaponSystems.find(w => w.id === selectedWeaponId);
  const mils   = weapon ? getMilsPerCircle(weapon) : 6400;
  const hasGun = gunPos.x !== '' && gunPos.y !== '';

  const getSolution = (p: MapPoint) => {
    if (!weapon || !hasGun) return null;
    return calculateFireSolution(
      weapon, selectedAmmoId, mortarMode,
      { x: Number(gunPos.x), y: Number(gunPos.y), h: Number(gunPos.h) || 0 },
      { x: p.x, y: p.y, h: p.h },
    );
  };

  // ── Open add form ──
  const openAdd = () => {
    setEditId(null);
    const initLoc = zones.length > 0 ? zones[0] : '';
    setAddForm({ ...emptyForm(), location: initLoc });
    setAddLocMode('zone');
    setShowForm(true);
  };

  const handleAdd = () => {
    const x = Number(addForm.x), y = Number(addForm.y), h = Number(addForm.h);
    if (!addForm.label || isNaN(x) || isNaN(y)) return;
    addPoint({
      mapId: selectedMapId,
      location: addForm.location || 'Без зоны',
      label: addForm.label,
      x, y,
      h: isNaN(h) ? 0 : h,
      note: addForm.note || null,
    });
    const initLoc = zones.length > 0 ? zones[0] : '';
    setAddForm({ ...emptyForm(), location: initLoc });
    setShowForm(false);
  };

  // ── Open edit form ──
  const openEdit = (p: MapPoint, e: React.MouseEvent) => {
    e.stopPropagation();
    setShowForm(false);
    setEditId(p.id);
    setEditForm({
      location: p.location,
      label:    p.label,
      x:        String(p.x),
      y:        String(p.y),
      h:        String(p.h),
      note:     p.note ?? '',
    });
    // figure out if this location is a known zone or custom
    setEditLocMode(zones.includes(p.location) ? 'zone' : 'custom');
  };

  const handleUpdate = () => {
    if (!editId) return;
    const x = Number(editForm.x), y = Number(editForm.y), h = Number(editForm.h);
    if (!editForm.label || isNaN(x) || isNaN(y)) return;
    updatePoint(editId, {
      location: editForm.location || 'Без зоны',
      label:    editForm.label,
      x, y,
      h:    isNaN(h) ? 0 : h,
      note: editForm.note || null,
    });
    setEditId(null);
  };

  return (
    <div className="flex flex-col gap-3 h-full">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="section-label mb-0">
            Точки{mapPoints.length > 0 && ` (${mapPoints.length})`}
          </div>
          {currentMap && (
            <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>
              {currentMap.names.ru || currentMap.names.en}
            </div>
          )}
        </div>
        <div className="flex gap-1 items-center shrink-0">
          <label className="btn-secondary" style={{ fontSize: 11, padding: '3px 6px', cursor: 'pointer', margin: 0 }} title="Импорт точек">
            📥 Импорт
            <input type="file" accept=".json" onChange={handleImportPoints} style={{ display: 'none' }} />
          </label>
          <button className="btn-secondary" style={{ fontSize: 11, padding: '3px 6px' }} onClick={exportPoints} title="Экспорт точек">
            📤 Экспорт
          </button>
          <button
            className="btn-secondary"
            style={{ fontSize: 11, padding: '3px 8px' }}
            onClick={() => showForm ? setShowForm(false) : openAdd()}
          >
            {showForm ? '✕' : '+ Добавить'}
          </button>
        </div>
      </div>

      {/* Search */}
      <input
        type="text" className="input-sm"
        placeholder="Поиск точки..."
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
      />

      {/* Add form */}
      {showForm && (
        <PointForm
          form={addForm} setForm={setAddForm}
          zones={zones}
          locationMode={addLocMode} setLocationMode={setAddLocMode}
          onSave={handleAdd}
          onCancel={() => setShowForm(false)}
          saveLabel="+ Создать"
        />
      )}

      {/* Points list grouped by location */}
      <div className="flex flex-col gap-3" style={{ overflowY: 'auto', flex: 1, paddingRight: 2 }}>
        {Object.keys(grouped).length === 0 && (
          <div style={{ color: '#334155', fontSize: 12, textAlign: 'center', padding: '24px 0' }}>
            {searchQuery ? 'Ничего не найдено' : 'Нет точек для этой карты'}
          </div>
        )}

        {Object.entries(grouped).map(([location, pts]) => (
          <div key={location}>
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: '#38bdf8',
              marginBottom: 5, paddingLeft: 2,
            }}>
              {location}
            </div>

            <div className="flex flex-col gap-1.5">
              {pts.map(p => {
                // ── Inline edit form for this point ──
                if (editId === p.id) {
                  return (
                    <PointForm
                      key={p.id}
                      form={editForm} setForm={setEditForm}
                      zones={zones}
                      locationMode={editLocMode} setLocationMode={setEditLocMode}
                      onSave={handleUpdate}
                      onCancel={() => setEditId(null)}
                      saveLabel="✓ Сохранить"
                    />
                  );
                }

                const sol = getSolution(p);
                return (
                  <div
                    key={p.id}
                    className="point-card"
                    onClick={() => loadPointAsTarget(p)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      {/* Left: name + coords */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontWeight: 600, color: '#e2e8f0', fontSize: 12,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {p.label}
                        </div>
                        <div style={{
                          fontSize: 10, color: '#475569',
                          fontFamily: 'JetBrains Mono, monospace', marginTop: 2,
                        }}>
                          {p.x} / {p.y} / {p.h}
                        </div>
                        {p.note && (
                          <div style={{ fontSize: 10, color: '#334155', fontStyle: 'italic', marginTop: 2 }}>
                            {p.note}
                          </div>
                        )}
                      </div>

                      {/* Right: fire solution preview */}
                      {hasGun && sol && (
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          {sol.status === 'ok' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                              <span style={{
                                fontFamily: 'JetBrains Mono, monospace', fontSize: 14,
                                fontWeight: 700, color: '#22c55e',
                              }}>
                                {formatMils(sol.azimuthMils, mils)}
                              </span>
                              {sol.elevation !== undefined && (
                                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#38bdf8' }}>
                                  ↑{sol.elevation}
                                </span>
                              )}
                              {(sol.elevationLow !== undefined || sol.elevationHigh !== undefined) && (
                                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#38bdf8' }}>
                                  {sol.elevationLow ?? '—'}/{sol.elevationHigh ?? '—'}
                                </span>
                              )}
                              <span style={{ fontSize: 10, color: '#475569' }}>
                                {Math.round(sol.distance)} м
                              </span>
                            </div>
                          ) : (
                            <span className="badge-red" style={{ fontSize: 9 }}>вне зоны</span>
                          )}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        <button
                          className="btn-ghost"
                          style={{ fontSize: 11, padding: '2px 5px' }}
                          onClick={e => openEdit(p, e)}
                          title="Редактировать"
                        >
                          ✏
                        </button>
                        <button
                          className="btn-ghost"
                          style={{ fontSize: 10, padding: '2px 5px', color: '#f87171' }}
                          onClick={e => { e.stopPropagation(); deletePoint(p.id); }}
                          title="Удалить"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
