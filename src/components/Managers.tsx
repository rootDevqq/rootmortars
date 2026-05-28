import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import type { GameMap } from '../types';

// ─── Map Manager ─────────────────────────────────────────────────────────────

function MapManager() {
  const { maps, selectedMapId, setSelectedMap, addMap, updateMap, deleteMap, importMaps } = useAppStore();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<GameMap>>({
    names: { en: '', ru: '' },
    gridSquareMeters: 1000,
    widthMeters: null,
    heightMeters: null,
    permanentZones: [],
  });
  const [zonesText, setZonesText] = useState('');

  const exportMaps = () => {
    const cleanMaps = maps.map(({ id, ...rest }) => rest);
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cleanMaps, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "rootmortars_maps.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportMaps = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        importMaps(Array.isArray(parsed) ? parsed : [parsed]);
      } catch (err) {
        alert('Ошибка при чтении JSON-файла карт.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const openNew = () => {
    setEditId(null);
    setForm({ names: { en: '', ru: '' }, gridSquareMeters: 1000, widthMeters: null, heightMeters: null, permanentZones: [] });
    setZonesText('');
    setShowForm(true);
  };

  const openEdit = (m: GameMap) => {
    setEditId(m.id);
    setForm({ ...m });
    setZonesText(m.permanentZones.join('\n'));
    setShowForm(true);
  };

  const handleSave = () => {
    const zones = zonesText.split('\n').map(z => z.trim()).filter(Boolean);
    const data: Omit<GameMap, 'id'> = {
      names: { en: form.names?.en ?? '', ru: form.names?.ru ?? '' },
      gridSquareMeters: Number(form.gridSquareMeters) || 1000,
      widthMeters: form.widthMeters ? Number(form.widthMeters) : null,
      heightMeters: form.heightMeters ? Number(form.heightMeters) : null,
      permanentZones: zones,
    };
    if (editId) updateMap(editId, data);
    else addMap(data);
    setShowForm(false);
    setEditId(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="section-label mb-0">Карты ({maps.length})</span>
        <div className="flex gap-1 items-center shrink-0">
          <label className="btn-secondary" style={{ fontSize: 11, padding: '3px 6px', cursor: 'pointer', margin: 0 }} title="Импорт карт">
            📥 Импорт
            <input type="file" accept=".json" onChange={handleImportMaps} style={{ display: 'none' }} />
          </label>
          <button className="btn-secondary" style={{ fontSize: 11, padding: '3px 6px' }} onClick={exportMaps} title="Экспорт карт">
            📤 Экспорт
          </button>
          <button className="btn-secondary" style={{ fontSize: 11, padding: '3px 8px' }} onClick={openNew}>
            + Добавить
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card-inner p-3 flex flex-col gap-2">
          <div className="section-label mb-0" style={{ color: '#22c55e' }}>
            {editId ? 'Редактировать' : 'Новая карта'}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field-label">Название (RU)</label>
              <input className="input-sm" placeholder="Фашивка"
                value={form.names?.ru ?? ''}
                onChange={e => setForm(f => ({ ...f, names: { en: f.names?.en ?? '', ru: e.target.value } }))} />
            </div>
            <div>
              <label className="field-label">Название (EN)</label>
              <input className="input-sm" placeholder="Faschivka"
                value={form.names?.en ?? ''}
                onChange={e => setForm(f => ({ ...f, names: { ru: f.names?.ru ?? '', en: e.target.value } }))} />
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
            <label className="field-label">Зоны (одна строка — одна зона)</label>
            <textarea
              className="input-sm"
              style={{ height: 64, resize: 'none' }}
              placeholder={'Казармы\nЗавод\nАрсеналы'}
              value={zonesText}
              onChange={e => setZonesText(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" style={{ fontSize: 11 }} onClick={handleSave}>Сохранить</button>
            <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => setShowForm(false)}>Отмена</button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {maps.length === 0 && (
          <div style={{ color: '#334155', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>Нет карт</div>
        )}
        {maps.map(m => (
          <div
            key={m.id}
            className="card-inner"
            style={{
              padding: '8px 10px',
              cursor: 'pointer',
              borderColor: m.id === selectedMapId ? '#22c55e50' : '#1a2333',
            }}
            onClick={() => setSelectedMap(m.id)}
          >
            <div className="flex items-start justify-between gap-2">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
                  {m.names.ru || m.names.en}
                  {m.id === selectedMapId && <span className="badge-green" style={{ fontSize: 8 }}>активна</span>}
                </div>
                <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>
                  {m.names.en && m.names.en !== m.names.ru && <span style={{ marginRight: 8 }}>{m.names.en}</span>}
                  Сетка: {m.gridSquareMeters} м
                  {m.widthMeters && ` · ${m.widthMeters}×${m.heightMeters ?? '?'} м`}
                </div>
                {m.permanentZones.length > 0 && (
                  <div style={{ fontSize: 10, color: '#334155', marginTop: 2 }}>
                    {m.permanentZones.slice(0, 4).join(' · ')}
                    {m.permanentZones.length > 4 && ' …'}
                  </div>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button className="btn-ghost" style={{ fontSize: 10, padding: '2px 6px' }}
                  onClick={e => { e.stopPropagation(); openEdit(m); }}>✏️</button>
                {maps.length > 1 && (
                  <button className="btn-danger" style={{ fontSize: 10, padding: '2px 6px' }}
                    onClick={e => { e.stopPropagation(); deleteMap(m.id); }}>✕</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Gun Position Manager ─────────────────────────────────────────────────────

function GunManager() {
  const {
    savedGuns,
    maps,
    selectedMapId,
    gunPos,
    addGun,
    updateGun,
    deleteGun,
    loadGunAsPosition,
    importGuns,
  } = useAppStore();

  const exportGuns = () => {
    const cleanGuns = savedGuns.map(({ id, ...rest }) => rest);
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cleanGuns, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "rootmortars_guns.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportGuns = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        importGuns(Array.isArray(parsed) ? parsed : [parsed]);
      } catch (err) {
        alert('Ошибка при чтении JSON-файла позиций.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

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

  const hasCurrentPos = gunPos.x !== '' && gunPos.y !== '';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-1.5">
        <span className="section-label mb-0">Позиции орудий</span>
        <div className="flex gap-1.5 items-center">
          <label className="btn-secondary" style={{ fontSize: 11, padding: '3px 6px', cursor: 'pointer', margin: 0 }} title="Импорт позиций">
            📥 Импорт
            <input type="file" accept=".json" onChange={handleImportGuns} style={{ display: 'none' }} />
          </label>
          <button className="btn-secondary" style={{ fontSize: 11, padding: '3px 6px' }} onClick={exportGuns} title="Экспорт позиций">
            📤 Экспорт
          </button>
          {hasCurrentPos && (
            <button className="btn-secondary" style={{ fontSize: 11, padding: '3px 8px' }}
              onClick={() => openNew(true)} title="Сохранить текущую позицию">
              💾 Текущую
            </button>
          )}
          <button className="btn-secondary" style={{ fontSize: 11, padding: '3px 8px' }}
            onClick={() => openNew(false)}>
            + Новая
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card-inner p-3 flex flex-col gap-2">
          <div className="section-label mb-0" style={{ color: '#22c55e' }}>
            {editId ? 'Редактировать' : 'Новая позиция'}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field-label">Название *</label>
              <input className="input-sm" placeholder="Огневая №1"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Карта</label>
              <select className="input-sm" value={form.mapId}
                onChange={e => setForm(f => ({ ...f, mapId: e.target.value }))}>
                {maps.map(m => (
                  <option key={m.id} value={m.id}>{m.names.ru || m.names.en}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="field-label">X *</label>
              <input type="number" className="input-sm" placeholder="4478"
                value={form.x} onChange={e => setForm(f => ({ ...f, x: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Y *</label>
              <input type="number" className="input-sm" placeholder="661"
                value={form.y} onChange={e => setForm(f => ({ ...f, y: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">H</label>
              <input type="number" className="input-sm" placeholder="116"
                value={form.h} onChange={e => setForm(f => ({ ...f, h: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" style={{ fontSize: 11 }} onClick={handleSave}>Сохранить</button>
            <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => setShowForm(false)}>Отмена</button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {savedGuns.length === 0 && (
          <div style={{ color: '#334155', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>
            Нет сохранённых позиций.
            {hasCurrentPos && (
              <div style={{ marginTop: 4, fontSize: 11 }}>Нажмите «Текущую» чтобы сохранить.</div>
            )}
          </div>
        )}
        {savedGuns.map(g => {
          const mapName = maps.find(m => m.id === g.mapId)?.names.ru ?? g.mapId;
          return (
            <div key={g.id} className="card-inner" style={{ padding: '8px 10px' }}>
              <div className="flex items-center justify-between gap-2">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 12 }}>{g.name}</div>
                  <div style={{ fontSize: 10, color: '#475569', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
                    {g.x} / {g.y} / {g.h} · {mapName}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button className="btn-primary" style={{ fontSize: 11, padding: '3px 8px' }}
                    onClick={() => loadGunAsPosition(g)}>
                    ↗ Загрузить
                  </button>
                  <button className="btn-ghost" style={{ fontSize: 11, padding: '3px 6px' }}
                    onClick={() => openEdit(g.id)}>✏️</button>
                  <button className="btn-danger" style={{ fontSize: 11, padding: '3px 6px' }}
                    onClick={() => deleteGun(g.id)}>✕</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Combined component with tabs ────────────────────────────────────────────

type ManagerTab = 'maps' | 'guns';

export function Managers() {
  const [tab, setTab] = useState<ManagerTab>('maps');

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Tab strip */}
      <div className="flex" style={{ borderBottom: '1px solid #1e2a3a', marginBottom: 4 }}>
        {(['maps', 'guns'] as ManagerTab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '6px 14px',
              fontSize: 11,
              fontWeight: 700,
              fontFamily: 'JetBrains Mono, monospace',
              letterSpacing: '0.06em',
              cursor: 'pointer',
              border: 'none',
              background: 'transparent',
              borderBottom: tab === t ? '2px solid #22c55e' : '2px solid transparent',
              color: tab === t ? '#22c55e' : '#475569',
              transition: 'all 0.12s',
            }}
          >
            {t === 'maps' ? 'КАРТЫ' : 'ПОЗИЦИИ'}
          </button>
        ))}
      </div>

      {tab === 'maps' ? <MapManager /> : <GunManager />}
    </div>
  );
}
