import { useAppStore } from '../store/appStore';
import { getHowitzerAmmoGroups, getMilsPerCircle } from '../utils/ballistics';

export function WeaponBar() {
  const {
    weaponSystems,
    selectedWeaponId,
    selectedAmmoId,
    mortarMode,
    maps,
    selectedMapId,
    setWeapon,
    setAmmo,
    setMortarMode,
    setSelectedMap,
    importAllData,
  } = useAppStore();

  const exportAll = () => {
    const data = {
      maps,
      points: useAppStore.getState().points,
      savedGuns: useAppStore.getState().savedGuns
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "rootmortars_backup.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.maps || parsed.points || parsed.savedGuns) {
          importAllData(parsed);
          alert('Полный бэкап успешно загружен!');
        } else {
          alert('Неверный формат файла бэкапа.');
        }
      } catch (err) {
        alert('Ошибка при чтении JSON-файла бэкапа.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const weapon = weaponSystems.find(w => w.id === selectedWeaponId);
  const isMortar = weapon?.systemType === 'mortar';

  let ammoOptions: { id: string; label: string }[] = [];
  if (weapon) {
    if (isMortar) {
      ammoOptions = (weapon.ammo ?? []).map(a => ({ id: a.id, label: a.name }));
    } else {
      const groups = getHowitzerAmmoGroups(weapon);
      ammoOptions = groups.map(g => ({ id: g.id, label: g.name }));
    }
  }

  const hasAdultMortars = isMortar && weapon?.ammo?.some(a => a.modes.adult_mortars);
  const milsPerCircle = weapon ? getMilsPerCircle(weapon) : null;

  return (
    <div className="flex flex-wrap items-center gap-2 w-full">
      {/* Weapon selector */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="field-label mb-0 whitespace-nowrap">Орудие</span>
        <select
          className="select"
          style={{ minWidth: 180, maxWidth: 240 }}
          value={selectedWeaponId}
          onChange={e => setWeapon(e.target.value)}
        >
          {weaponSystems.length === 0 && <option disabled value="">Загрузка…</option>}
          {weaponSystems.map(w => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </div>

      {/* Ammo selector */}
      {ammoOptions.length > 0 && (
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="field-label mb-0 whitespace-nowrap">Снаряд</span>
          <select
            className="select"
            style={{ minWidth: 120, maxWidth: 200 }}
            value={selectedAmmoId}
            onChange={e => setAmmo(e.target.value)}
          >
            {ammoOptions.map(o => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Vanilla / AM toggle (mortars only) */}
      {hasAdultMortars && (
        <div className="toggle-group" style={{ minWidth: 160 }}>
          <div
            className={`toggle-btn ${mortarMode === 'original' ? 'toggle-on' : 'toggle-off'}`}
            onClick={() => setMortarMode('original')}
          >
            Vanilla
          </div>
          <div
            className={`toggle-btn ${mortarMode === 'adult_mortars' ? 'toggle-on' : 'toggle-off'}`}
            onClick={() => setMortarMode('adult_mortars')}
          >
            Adult Mortars
          </div>
        </div>
      )}

      {/* Weapon info chip */}
      {weapon && (
        <div className="flex items-center gap-1.5">
          <span className="badge-muted">{weapon.caliber}mm</span>
          {milsPerCircle && (
            <span className="badge-muted">{milsPerCircle} mil</span>
          )}
          <span className="badge-muted uppercase">{weapon.systemType}</span>
        </div>
      )}

      {/* Map selector — pushed to the right on wide screens */}
      <div className="flex items-center gap-1.5 ml-auto min-w-0">
        {maps.length > 0 && (
          <>
            <span className="field-label mb-0 whitespace-nowrap">Карта</span>
            <select
              className="select"
              style={{ minWidth: 120, maxWidth: 180 }}
              value={selectedMapId}
              onChange={e => setSelectedMap(e.target.value)}
            >
              {maps.map(m => (
                <option key={m.id} value={m.id}>{m.names.ru || m.names.en}</option>
              ))}
            </select>
          </>
        )}
        
        {/* Global Backup & Restore buttons */}
        <div className="flex gap-1 items-center shrink-0 ml-1">
          <label className="btn-secondary" style={{ fontSize: 11, padding: '5px 8px', cursor: 'pointer', margin: 0 }} title="Импортировать полный бэкап (JSON)">
            📥 Бэкап
            <input type="file" accept=".json" onChange={handleImportAll} style={{ display: 'none' }} />
          </label>
          <button className="btn-secondary" style={{ fontSize: 11, padding: '5px 8px' }} onClick={exportAll} title="Экспортировать полный бэкап (JSON)">
            📤 Скачать
          </button>
        </div>
      </div>
    </div>
  );
}
