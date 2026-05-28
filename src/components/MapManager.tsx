import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import type { GameMap } from '../types';

// ─── Zone chips ───────────────────────────────────────────────────────────────

function ZoneChips({
  zones,
  onChange,
}: {
  zones: string[];
  onChange: (z: string[]) => void;
}) {
  const [input, setInput] = useState('');

  const add = () => {
    const v = input.trim();
    if (v && !zones.includes(v)) onChange([...zones, v]);
    setInput('');
  };

  const remove = (i: number) => onChange(zones.filter((_, idx) => idx !== i));

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6, minHeight: 24 }}>
        {zones.length === 0 && (
          <span style={{ fontSize: 10, color: '#334155', alignSelf: 'center' }}>Зон нет</span>
        )}
        {zones.map((z, i) => (
          <span key={i} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: '#1a2333', border: '1px solid #263448', borderRadius: 4,
            padding: '2px 7px', fontSize: 11, color: '#94a3b8',
          }}>
            {z}
            <button
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#475569', padding: 0, fontSize: 13, lineHeight: 1,
                display: 'flex', alignItems: 'center',
              }}
              onClick={() => remove(i)}
              title="Удалить зону"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          className="input-sm" style={{ flex: 1 }}
          placeholder="Добавить зону..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
        <button
          className="btn-secondary"
          style={{ fontSize: 11, padding: '4px 10px', flexShrink: 0 }}
          onClick={add}
        >
          +
        </button>
      </div>
    </div>
  );
}

// ─── Map Manager ──────────────────────────────────────────────────────────────

export function MapManager() {
  const { maps, selectedMapId, setSelectedMap, addMap, updateMap, deleteMap } = useAppStore();

  const [showForm,     setShowForm]     = useState(false);
  const [editId,       setEditId]       = useState<string | null>(null);
  const [zonesOpenId,  setZonesOpenId]  = useState<string | null>(null);

  const [form, setForm] = useState<Partial<GameMap>>({
    names: { en: '', ru: '' },
    gridSquareMeters: 1000,
    widthMeters: null,
    heightMeters: null,
    permanentZones: [],
  });

  const openNew = () => {
    setEditId(null);
    setZonesOpenId(null);
    setForm({
      names: { en: '', ru: '' },
      gridSquareMeters: 1000,
      widthMeters: null,
      heightMeters: null,
      permanentZones: [],
    });
    setShowForm(true);
  };

  const openEdit = (m: GameMap) => {
    setEditId(m.id);
    setZonesOpenId(null);
    setForm({ ...m, permanentZones: [...m.permanentZones] });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditId(null);
  };

  const handleSave = () => {
    const nameEn = form.names?.en?.trim() ?? '';
    const nameRu = form.names?.ru?.trim() ?? '';
    if (!nameEn && !nameRu) return;
    const data: Omit<GameMap, 'id'> = {
      names: { en: nameEn, ru: nameRu },
      gridSquareMeters: Number(form.gridSquareMeters) || 1000,
      widthMeters:  form.widthMeters  ? Number(form.widthMeters)  : null,
      heightMeters: form.heightMeters ? Number(form.heightMeters) : null,
      permanentZones: form.permanentZones ?? [],
    };
    if (editId) updateMap(editId, data);
    else addMap(data);
    setShowForm(false);
    setEditId(null);
  };

  // Inline zone edit: auto-save on every change
  const handleInlineZones = (mapId: string, zones: string[]) => {
    updateMap(mapId, { permanentZones: zones });
  };

  const toggleZones = (mapId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setZonesOpenId(prev => (prev === mapId ? null : mapId));
    setShowForm(false);
  };

  return (
    <div className="flex flex-col gap-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="section-label mb-0">Карты ({maps.length})</span>
        {!showForm && (
          <button
            className="btn-secondary"
            style={{ fontSize: 11, padding: '3px 10px' }}
            onClick={openNew}
          >
            + Добавить
          </button>
        )}
        {showForm && (
          <button
            className="btn-ghost"
            style={{ fontSize: 11, padding: '3px 10px' }}
            onClick={handleCancel}
          >
            ✕ Отмена
          </button>
        )}
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className="card-inner p-3 flex flex-col gap-3 fade-in">
          <div className="section-label mb-0" style={{ color: '#22c55e' }}>
            {editId ? 'Редактировать карту' : 'Новая карта'}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field-label">Название (RU) *</label>
              <input
                className="input-sm" placeholder="Фашивка" autoFocus
                value={form.names?.ru ?? ''}
                onChange={e => setForm(f => ({ ...f, names: { en: f.names?.en ?? '', ru: e.target.value } }))}
              />
            </div>
            <div>
              <label className="field-label">Название (EN)</label>
              <input
                className="input-sm" placeholder="Faschivka"
                value={form.names?.en ?? ''}
                onChange={e => setForm(f => ({ ...f, names: { ru: f.names?.ru ?? '', en: e.target.value } }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="field-label">Сетка (м)</label>
              <input type="number" className="input-sm"
                value={form.gridSquareMeters ?? 1000}
                onChange={e => setForm(f => ({ ...f, gridSquareMeters: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="field-label">Ширина (м)</label>
              <input type="number" className="input-sm" placeholder="необяз."
                value={form.widthMeters ?? ''}
                onChange={e => setForm(f => ({ ...f, widthMeters: e.target.value ? Number(e.target.value) : null }))} />
            </div>
            <div>
              <label className="field-label">Высота (м)</label>
              <input type="number" className="input-sm" placeholder="необяз."
                value={form.heightMeters ?? ''}
                onChange={e => setForm(f => ({ ...f, heightMeters: e.target.value ? Number(e.target.value) : null }))} />
            </div>
          </div>

          <div>
            <label className="field-label" style={{ marginBottom: 6 }}>Зоны</label>
            <ZoneChips
              zones={form.permanentZones ?? []}
              onChange={z => setForm(f => ({ ...f, permanentZones: z }))}
            />
          </div>

          <div className="flex gap-2">
            <button className="btn-primary" style={{ fontSize: 11, flex: 1 }} onClick={handleSave}>
              {editId ? '✓ Сохранить' : '+ Создать'}
            </button>
            <button className="btn-ghost" style={{ fontSize: 11 }} onClick={handleCancel}>
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Map list */}
      <div className="flex flex-col gap-2">
        {maps.length === 0 && (
          <div style={{ color: '#334155', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>
            Нет карт
          </div>
        )}

        {maps.map(m => {
          const isZonesOpen = zonesOpenId === m.id;
          return (
            <div
              key={m.id}
              className="card-inner"
              style={{
                borderColor: m.id === selectedMapId ? '#22c55e50' : '#1a2333',
                transition: 'border-color 0.15s',
              }}
            >
              {/* Map row */}
              <div
                style={{ padding: '8px 10px', cursor: 'pointer' }}
                onClick={() => setSelectedMap(m.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 600, color: '#e2e8f0', fontSize: 12,
                      display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap',
                    }}>
                      {m.names.ru || m.names.en}
                      {m.id === selectedMapId && (
                        <span className="badge-green" style={{ fontSize: 8 }}>активна</span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>
                      {m.names.en && m.names.en !== m.names.ru && (
                        <span style={{ marginRight: 8 }}>{m.names.en}</span>
                      )}
                      Сетка: {m.gridSquareMeters} м
                      {m.widthMeters && ` · ${m.widthMeters}×${m.heightMeters ?? '?'} м`}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    {/* Zones toggle */}
                    <button
                      className="btn-ghost"
                      style={{
                        fontSize: 10, padding: '2px 7px',
                        color: isZonesOpen ? '#22c55e' : undefined,
                        borderColor: isZonesOpen ? '#22c55e40' : undefined,
                      }}
                      onClick={e => toggleZones(m.id, e)}
                      title="Редактировать зоны"
                    >
                      Зоны{m.permanentZones.length > 0 ? ` (${m.permanentZones.length})` : ''}
                      {' '}{isZonesOpen ? '▲' : '▼'}
                    </button>
                    <button
                      className="btn-ghost"
                      style={{ fontSize: 11, padding: '2px 7px' }}
                      onClick={e => { e.stopPropagation(); openEdit(m); }}
                      title="Редактировать карту"
                    >
                      ✏
                    </button>
                    {maps.length > 1 && (
                      <button
                        className="btn-danger"
                        style={{ fontSize: 11, padding: '2px 7px' }}
                        onClick={e => { e.stopPropagation(); deleteMap(m.id); }}
                        title="Удалить карту"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Inline zone editor */}
              {isZonesOpen && (
                <div style={{
                  borderTop: '1px solid #1e2a3a',
                  padding: '10px 10px 12px',
                  background: '#0a0e1480',
                }}
                  className="fade-in"
                >
                  <div className="section-label mb-2" style={{ color: '#22c55e' }}>
                    Зоны — {m.names.ru || m.names.en}
                  </div>
                  <ZoneChips
                    zones={m.permanentZones}
                    onChange={z => handleInlineZones(m.id, z)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
