import { useEffect } from 'react';
import { useAppStore } from './store/appStore';
import { WeaponBar }           from './components/WeaponBar';
import { GunInput }            from './components/GunInput';
import { TargetInput }         from './components/TargetInput';
import { FireResult }          from './components/FireResult';
import { AreaFire }            from './components/AreaFire';
import { WindInput }           from './components/WindInput';
import { PointsPanel }         from './components/PointsPanel';
import { GunPositionManager }  from './components/GunPositionManager';
import { MapManager }          from './components/MapManager';

// ─── Center panel: Точки | Позиции | Карты ────────────────────────────────────

type CenterTab = 'points' | 'guns' | 'maps';
const CENTER_TABS: { id: CenterTab; label: string; icon: string }[] = [
  { id: 'points', label: 'Точки',   icon: '◈' },
  { id: 'guns',   label: 'Позиции', icon: '▲' },
  { id: 'maps',   label: 'Карты',   icon: '◻' },
];

function CenterPanel() {
  const { rightTab, setRightTab } = useAppStore();
  const tab = rightTab as CenterTab;

  return (
    <div className="card flex flex-col" style={{ height: 'calc(100vh - 76px)', overflow: 'hidden' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1e2a3a', flexShrink: 0 }}>
        {CENTER_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setRightTab(t.id)}
            style={{
              flex: 1, padding: '8px 4px',
              fontSize: 11, fontWeight: 700,
              fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em',
              cursor: 'pointer', background: 'transparent', border: 'none',
              borderBottom: `2px solid ${tab === t.id ? '#22c55e' : 'transparent'}`,
              color: tab === t.id ? '#22c55e' : '#475569',
              transition: 'all 0.15s',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {tab === 'points' && <PointsPanel />}
        {tab === 'guns'   && <GunPositionManager />}
        {tab === 'maps'   && <MapManager />}
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export function App() {
  const { loadData, dataLoaded, dataError } = useAppStore();

  useEffect(() => { loadData(); }, [loadData]);

  if (dataError) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="card" style={{ padding: 24, maxWidth: 360, textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⚠</div>
          <div style={{ color: '#f87171', fontWeight: 700 }}>Ошибка загрузки данных</div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{dataError}</div>
        </div>
      </div>
    );
  }

  if (!dataLoaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 8, color: '#475569' }}>
        <span className="pulse-green" style={{ color: '#22c55e' }}>●</span>
        <span style={{ fontSize: 13 }}>Загрузка данных…</span>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: '#0d121990', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #1e2a3a', padding: '7px 14px',
      }}>
        <div style={{ maxWidth: 1700, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 800, color: '#22c55e', letterSpacing: '0.08em', fontSize: 14, flexShrink: 0 }}>
            ROOTMORTARS
          </span>
          <div style={{ width: 1, height: 18, background: '#1e2a3a', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}><WeaponBar /></div>
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{ flex: 1, maxWidth: 1700, margin: '0 auto', width: '100%', padding: '10px 12px' }}>

        {/* DESKTOP 3-col: [Ввод | Данные/вкладки | Результат] */}
        <div
          className="hidden lg:grid"
          style={{ gridTemplateColumns: '340px 1fr 360px', gap: 10, alignItems: 'start' }}
        >
          {/* Col 1 — Ввод координат + ветер */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <GunInput />
            <TargetInput />
            <WindInput />
          </div>

          {/* Col 2 — Точки / Позиции / Карты */}
          <CenterPanel />

          {/* Col 3 — Результат + Площадной огонь */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <FireResult />
            <AreaFire />
          </div>
        </div>

        {/* MOBILE — стек без навигации */}
        <div className="lg:hidden flex flex-col gap-4">
          <GunInput />
          <TargetInput />
          <WindInput />
          <FireResult />

          <AreaFire />
          <div className="card p-3"><PointsPanel /></div>
          <div className="card p-3"><GunPositionManager /></div>
          <div className="card p-3"><MapManager /></div>
        </div>
      </div>
    </div>
  );
}
