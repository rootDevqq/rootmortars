import { useState } from 'react';
import { useAppStore } from '../store/appStore';

export function GunPositionManager() {
  const {
    savedGuns,
    maps,
    selectedMapId,
    gunPos,
    addGun,
    updateGun,
    deleteGun,
    loadGunAsPosition,
  } = useAppStore();

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', mapId: selectedMapId, x: '', y: '', h: '' });

  const openNew = (prefill = false) => {
    setEditId(null);
    setForm({
      name: '',
      mapId: selectedMapId,
      x: prefill ? String(gunPos.x) : '',
      y: prefill ? String(gunPos.y) : '',
      h: prefill ? String(gunPos.h) : '',
    });
    setShowForm(true);
  };

  const openEdit = (id: string) => {
    const g = savedGuns.find(g => g.id === id);
    if (!g) return;
    setEditId(id);
    setForm({ name: g.name, mapId: g.mapId, x: String(g.x), y: String(g.y), h: String(g.h) });
    setShowForm(true);
  };

  const handleSave = () => {
    const x = Number(form.x), y = Number(form.y), h = Number(form.h);
    if (!form.name || isNaN(x) || isNaN(y)) return;
    const data = { name: form.name, mapId: form.mapId, x, y, h: isNaN(h) ? 0 : h };
    if (editId) updateGun(editId, data);
    else addGun(data);
    setShowForm(false);
    setEditId(null);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditId(null);
  };

  const hasCurrentPos = gunPos.x !== '' && gunPos.y !== '';

  return (
    <div className="flex flex-col gap-3">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-1.5">
        <span className="section-label mb-0">Позиции орудий ({savedGuns.length})</span>
        <div className="flex gap-1.5">
          {hasCurrentPos && !showForm && (
            <button
              className="btn-secondary"
              style={{ fontSize: 11, padding: '3px 10px' }}
              onClick={() => openNew(true)}
              title="Сохранить текущую позицию"
            >
              💾 Текущую
            </button>
          )}
          {!showForm && (
            <button
              className="btn-secondary"
              style={{ fontSize: 11, padding: '3px 10px' }}
              onClick={() => openNew(false)}
            >
              + Новая
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
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className="card-inner p-3 flex flex-col gap-2 fade-in">
          <div className="section-label mb-0" style={{ color: '#22c55e' }}>
            {editId ? 'Редактировать позицию' : 'Новая позиция'}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field-label">Название *</label>
              <input
                className="input-sm"
                placeholder="Огневая №1"
                value={form.name}
                autoFocus
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
              />
            </div>
            <div>
              <label className="field-label">Карта</label>
              <select
                className="input-sm select"
                value={form.mapId}
                onChange={e => setForm(f => ({ ...f, mapId: e.target.value }))}
              >
                {maps.map(m => (
                  <option key={m.id} value={m.id}>{m.names.ru || m.names.en}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="field-label">X *</label>
              <input
                type="number"
                className="input-sm"
                placeholder="4478"
                value={form.x}
                onChange={e => setForm(f => ({ ...f, x: e.target.value }))}
              />
            </div>
            <div>
              <label className="field-label">Y *</label>
              <input
                type="number"
                className="input-sm"
                placeholder="661"
                value={form.y}
                onChange={e => setForm(f => ({ ...f, y: e.target.value }))}
              />
            </div>
            <div>
              <label className="field-label">H</label>
              <input
                type="number"
                className="input-sm"
                placeholder="116"
                value={form.h}
                onChange={e => setForm(f => ({ ...f, h: e.target.value }))}
              />
            </div>
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

      {/* List */}
      <div className="flex flex-col gap-2">
        {savedGuns.length === 0 && (
          <div style={{ color: '#334155', fontSize: 12, textAlign: 'center', padding: '24px 0' }}>
            Нет сохранённых позиций.
            {hasCurrentPos && (
              <div style={{ marginTop: 6, fontSize: 11 }}>
                Нажмите <span style={{ color: '#94a3b8' }}>«💾 Текущую»</span>, чтобы сохранить.
              </div>
            )}
          </div>
        )}

        {savedGuns.map(g => {
          const mapName = maps.find(m => m.id === g.mapId)?.names.ru ?? '—';
          const isEditing = editId === g.id && showForm;
          return (
            <div
              key={g.id}
              className="card-inner"
              style={{
                padding: '8px 10px',
                borderColor: isEditing ? '#22c55e50' : '#1a2333',
                transition: 'border-color 0.15s',
              }}
            >
              <div className="flex items-center justify-between gap-2">
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 12 }}>{g.name}</div>
                  <div style={{
                    fontSize: 10, color: '#475569',
                    fontFamily: 'JetBrains Mono, monospace', marginTop: 2,
                  }}>
                    {g.x} / {g.y} / {g.h}
                  </div>
                  <div style={{ fontSize: 10, color: '#334155', marginTop: 1 }}>{mapName}</div>
                </div>

                {/* Actions */}
                <div className="flex gap-1 shrink-0">
                  <button
                    className="btn-primary"
                    style={{ fontSize: 10, padding: '3px 8px' }}
                    onClick={() => loadGunAsPosition(g)}
                    title="Загрузить как текущую позицию"
                  >
                    ↗ Загрузить
                  </button>
                  <button
                    className="btn-ghost"
                    style={{ fontSize: 11, padding: '3px 7px' }}
                    onClick={() => openEdit(g.id)}
                    title="Редактировать"
                  >
                    ✏
                  </button>
                  <button
                    className="btn-danger"
                    style={{ fontSize: 11, padding: '3px 7px' }}
                    onClick={() => deleteGun(g.id)}
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
  );
}
