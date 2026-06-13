import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { v4 as uuidv4 } from 'uuid';
import {
  WeaponSystem, GameMap, MapPoint, SavedGunPosition,
  Position, MortarMode, FireSolution, WindDatabase, HowitzerChargeMode,
} from '../types';
import {
  calculateFireSolution, getHowitzerAmmoGroups,
  getMilsPerCircle, numpadOffset, applyCorrection,
} from '../utils/ballistics';

// ─── State ────────────────────────────────────────────────────────────────────

interface AppState {
  weaponSystems: WeaponSystem[];
  dataLoaded: boolean;
  dataError: string | null;

  selectedWeaponId: string;
  selectedAmmoId:   string;
  mortarMode: MortarMode;
  howitzerCharge: HowitzerChargeMode;   // 'auto' or forced charge level (M777)

  gunPos:    Position;
  targetPos: Position;

  numpadStep:      number;
  correctionRange: number;
  correctionAz:    number;

  maps:          GameMap[];
  selectedMapId: string;
  points:        MapPoint[];
  savedGuns:     SavedGunPosition[];

  fireSolution: FireSolution | null;

  // Wind
  windSpeed: number;   // m/s, 0–20
  windDir:   number;   // degrees FROM which wind blows (Arma 1.7 convention)
  windDb:    WindDatabase | null;

  // UI tabs
  rightTab:  'points' | 'guns' | 'maps';   // desktop right panel
  mobileTab: 'calc' | 'points' | 'guns' | 'maps'; // mobile bottom nav

  // ── Actions ──
  loadData: () => Promise<void>;

  setWeapon:     (id: string) => void;
  setAmmo:       (id: string) => void;
  setMortarMode: (m: MortarMode) => void;
  setHowitzerCharge: (c: HowitzerChargeMode) => void;
  setGunPos:     (field: keyof Position, value: number | '') => void;
  setTargetPos:  (field: keyof Position, value: number | '') => void;
  loadPointAsTarget: (p: MapPoint) => void;
  loadGunAsPosition: (g: SavedGunPosition) => void;
  recalculate: () => void;

  setNumpadStep:      (s: number) => void;
  setCorrectionRange: (v: number) => void;
  setCorrectionAz:    (v: number) => void;
  applyNumpad:        (key: number) => void;
  applyFire:          () => void;
  resetCorrection:    () => void;

  setSelectedMap: (id: string) => void;
  addMap:    (m: Omit<GameMap, 'id'>) => void;
  updateMap: (id: string, partial: Partial<GameMap>) => void;
  deleteMap: (id: string) => void;

  addPoint:     (p: Omit<MapPoint, 'id'>) => void;
  updatePoint:  (id: string, partial: Partial<MapPoint>) => void;
  deletePoint:  (id: string) => void;

  addGun:    (g: Omit<SavedGunPosition, 'id'>) => void;
  updateGun: (id: string, partial: Partial<SavedGunPosition>) => void;
  deleteGun: (id: string) => void;

  setWindSpeed: (v: number) => void;
  setWindDir:   (v: number) => void;

  setRightTab:  (t: AppState['rightTab'])  => void;
  setMobileTab: (t: AppState['mobileTab']) => void;

  importAllData: (data: { maps?: any[]; points?: any[]; savedGuns?: any[] }) => void;
  importPoints:  (points: any[]) => void;
  importGuns:    (guns: any[]) => void;
  importMaps:    (maps: any[]) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

type SetFn = (fn: (s: AppState) => void) => void;
type GetFn = () => AppState;

export const useAppStore = create<AppState>()(
  persist(
    immer((set: SetFn, get: GetFn) => ({
      weaponSystems: [],
      dataLoaded: false,
      dataError: null,

      selectedWeaponId: '',
      selectedAmmoId:   '',
      mortarMode: 'original',
      howitzerCharge: 'auto',

      gunPos:    { x: '', y: '', h: '' },
      targetPos: { x: '', y: '', h: '' },

      numpadStep: 100,
      correctionRange: 0,
      correctionAz: 0,

      maps: [],
      selectedMapId: '',
      points: [],
      savedGuns: [],
      fireSolution: null,

      windSpeed: 0,
      windDir:   0,
      windDb:    null,

      rightTab:  'points',
      mobileTab: 'calc',

      // ── load data ──────────────────────────────────────────────────────────

      loadData: async () => {
        if (get().dataLoaded) return;
        try {
          const [wRes, mRes, pRes, windRes] = await Promise.all([
            fetch(`${import.meta.env.BASE_URL}data/weapons.json`),
            fetch(`${import.meta.env.BASE_URL}data/maps.json`),
            fetch(`${import.meta.env.BASE_URL}data/points.json`),
            fetch(`${import.meta.env.BASE_URL}data/wind.json`),
          ]);
          const [wData, mData, pData, windData] = await Promise.all([
            wRes.json(), mRes.json(), pRes.json(), windRes.json(),
          ]);

          set(s => {
            s.weaponSystems = wData.weaponSystems ?? [];
            s.windDb = windData ?? null;

            if (s.maps.length === 0) {
              s.maps = (mData.maps ?? []).map((m: GameMap) => ({ ...m }));
              if (s.maps.length > 0) s.selectedMapId = s.maps[0].id;
            }

            if (s.points.length === 0) {
              const seedMap = s.maps.find(
                (m: GameMap) => m.names.en.toLowerCase() === pData.map?.toLowerCase()
              );
              s.points = (pData.points ?? []).map(
                (p: Omit<MapPoint, 'id' | 'mapId'>) => ({
                  ...p,
                  id: uuidv4(),
                  mapId: seedMap?.id ?? s.maps[0]?.id ?? '',
                })
              );
            }

            if (!s.selectedWeaponId && s.weaponSystems.length > 0) {
              const w = s.weaponSystems[0] as WeaponSystem;
              s.selectedWeaponId = w.id;
              if (w.systemType === 'mortar') {
                s.selectedAmmoId = w.ammo?.[0]?.id ?? '';
              } else {
                const groups = getHowitzerAmmoGroups(w);
                s.selectedAmmoId = groups[0]?.id ?? '';
              }
            }

            s.dataLoaded = true;
          });
        } catch (e) {
          set(s => { s.dataError = String(e); });
        }
      },

      // ── weapon ─────────────────────────────────────────────────────────────

      setWeapon: (id) => set(s => {
        s.selectedWeaponId = id;
        const w = s.weaponSystems.find((w: WeaponSystem) => w.id === id) as WeaponSystem | undefined;
        if (w) {
          if (w.systemType === 'mortar') {
            s.selectedAmmoId = w.ammo?.[0]?.id ?? '';
          } else {
            s.selectedAmmoId = getHowitzerAmmoGroups(w)[0]?.id ?? '';
          }
        }
        s.howitzerCharge = 'auto';
        s.fireSolution = null;
      }),

      setAmmo:       (id) => set(s => { s.selectedAmmoId = id; s.howitzerCharge = 'auto'; s.fireSolution = null; }),
      setMortarMode: (m)  => set(s => { s.mortarMode = m;      s.fireSolution = null; }),
      setHowitzerCharge: (c) => set(s => { s.howitzerCharge = c; s.fireSolution = null; }),

      // ── positions ──────────────────────────────────────────────────────────

      setGunPos: (field, value) => set(s => {
        (s.gunPos as Position)[field] = value;
        s.fireSolution = null;
      }),
      setTargetPos: (field, value) => set(s => {
        (s.targetPos as Position)[field] = value;
        s.fireSolution = null;
      }),

      loadPointAsTarget: (p) => set(s => {
        s.targetPos   = { x: p.x, y: p.y, h: p.h };
        s.mobileTab   = 'calc';
        s.fireSolution = null;
      }),

      loadGunAsPosition: (g) => set(s => {
        s.gunPos      = { x: g.x, y: g.y, h: g.h };
        s.fireSolution = null;
      }),

      // ── numpad & correction ────────────────────────────────────────────────

      setNumpadStep:      (step) => set(s => { s.numpadStep      = step; }),
      setCorrectionRange: (v)    => set(s => { s.correctionRange = v; }),
      setCorrectionAz:    (v)    => set(s => { s.correctionAz    = v; }),

      applyNumpad: (key) => set(s => {
        const tx = Number(s.targetPos.x), ty = Number(s.targetPos.y);
        if (isNaN(tx) || isNaN(ty)) return;
        const { x, y } = numpadOffset(tx, ty, key, s.numpadStep);
        s.targetPos.x  = x;
        s.targetPos.y  = y;
        s.fireSolution = null;
      }),

      applyFire: () => set(s => {
        const gx = Number(s.gunPos.x),    gy = Number(s.gunPos.y);
        const tx = Number(s.targetPos.x), ty = Number(s.targetPos.y);
        if (isNaN(gx) || isNaN(gy) || isNaN(tx) || isNaN(ty)) return;
        const weapon = s.weaponSystems.find((w: WeaponSystem) => w.id === s.selectedWeaponId) as WeaponSystem | undefined;
        const mils   = weapon ? getMilsPerCircle(weapon) : 6400;
        const { x, y } = applyCorrection(gx, gy, tx, ty, s.correctionRange, s.correctionAz, mils);
        s.targetPos.x    = x;
        s.targetPos.y    = y;
        s.correctionRange = 0;
        s.correctionAz   = 0;
        s.fireSolution   = null;
      }),

      resetCorrection: () => set(s => { s.correctionRange = 0; s.correctionAz = 0; }),

      // ── wind ──────────────────────────────────────────────────────────────
      setWindSpeed: (v) => set(s => { s.windSpeed = Math.max(0, Math.min(20, v)); }),
      setWindDir:   (v) => set(s => { s.windDir = ((Math.round(v) % 360) + 360) % 360; }),

      // ── recalculate ───────────────────────────────────────────────────────

      recalculate: () => {
        const { weaponSystems, selectedWeaponId, selectedAmmoId, mortarMode, howitzerCharge, gunPos, targetPos, windSpeed, windDir, windDb } = get();
        const weapon = weaponSystems.find(w => w.id === selectedWeaponId);
        if (!weapon) { set(s => { s.fireSolution = null; }); return; }
        const windOpts = { speed: windSpeed, dir: windDir, db: windDb };
        const result = calculateFireSolution(weapon, selectedAmmoId, mortarMode, gunPos, targetPos, windOpts, howitzerCharge);
        set(s => { s.fireSolution = result; });
      },

      // ── maps ──────────────────────────────────────────────────────────────

      setSelectedMap: (id) => set(s => { s.selectedMapId = id; }),

      addMap: (m) => set(s => {
        const id = uuidv4();
        s.maps.push({ ...m, id });
        if (!s.selectedMapId) s.selectedMapId = id;
      }),
      updateMap: (id, partial) => set(s => {
        const i = s.maps.findIndex((m: GameMap) => m.id === id);
        if (i >= 0) Object.assign(s.maps[i], partial);
      }),
      deleteMap: (id) => set(s => {
        s.maps = s.maps.filter((m: GameMap) => m.id !== id);
        if (s.selectedMapId === id) s.selectedMapId = s.maps[0]?.id ?? '';
      }),

      // ── points ────────────────────────────────────────────────────────────

      addPoint:    (p)          => set(s => { s.points.push({ ...p, id: uuidv4() }); }),
      updatePoint: (id, partial) => set(s => {
        const i = s.points.findIndex((p: MapPoint) => p.id === id);
        if (i >= 0) Object.assign(s.points[i], partial);
      }),
      deletePoint: (id) => set(s => { s.points = s.points.filter((p: MapPoint) => p.id !== id); }),

      // ── guns ──────────────────────────────────────────────────────────────

      addGun: (g) => set(s => { s.savedGuns.push({ ...g, id: uuidv4() }); }),
      updateGun: (id, partial) => set(s => {
        const i = s.savedGuns.findIndex((g: SavedGunPosition) => g.id === id);
        if (i >= 0) Object.assign(s.savedGuns[i], partial);
      }),
      deleteGun: (id) => set(s => { s.savedGuns = s.savedGuns.filter((g: SavedGunPosition) => g.id !== id); }),

      // ── ui tabs ───────────────────────────────────────────────────────────

      setRightTab:  (t) => set(s => { s.rightTab  = t; }),
      setMobileTab: (t) => set(s => { s.mobileTab = t; }),

      importAllData: (data) => set(s => {
        if (data.maps && Array.isArray(data.maps)) {
          data.maps.forEach((m: any) => {
            const id = m.id || uuidv4();
            const existingIdx = s.maps.findIndex(x => x.id === id);
            const item = {
              id,
              names: { ru: m.names?.ru || '', en: m.names?.en || '' },
              gridSquareMeters: Number(m.gridSquareMeters) || 1000,
              widthMeters: m.widthMeters ? Number(m.widthMeters) : null,
              heightMeters: m.heightMeters ? Number(m.heightMeters) : null,
              permanentZones: Array.isArray(m.permanentZones) ? m.permanentZones : [],
            };
            if (existingIdx >= 0) s.maps[existingIdx] = item;
            else s.maps.push(item);
          });
          if (s.maps.length > 0 && !s.selectedMapId) {
            s.selectedMapId = s.maps[0].id;
          }
        }
        if (data.points && Array.isArray(data.points)) {
          data.points.forEach((p: any) => {
            const id = p.id || uuidv4();
            const mapId = p.mapId || s.selectedMapId || '';
            const existingIdx = s.points.findIndex(x => x.id === id);
            const item = {
              id,
              mapId,
              location: p.location || 'Без зоны',
              label: p.label || 'Точка',
              x: Number(p.x) || 0,
              y: Number(p.y) || 0,
              h: Number(p.h) || 0,
              note: p.note || null,
            };
            if (existingIdx >= 0) s.points[existingIdx] = item;
            else s.points.push(item);
          });
        }
        if (data.savedGuns && Array.isArray(data.savedGuns)) {
          data.savedGuns.forEach((g: any) => {
            const id = g.id || uuidv4();
            const mapId = g.mapId || s.selectedMapId || '';
            const existingIdx = s.savedGuns.findIndex(x => x.id === id);
            const item = {
              id,
              name: g.name || 'Огневая',
              mapId,
              x: Number(g.x) || 0,
              y: Number(g.y) || 0,
              h: Number(g.h) || 0,
            };
            if (existingIdx >= 0) s.savedGuns[existingIdx] = item;
            else s.savedGuns.push(item);
          });
        }
      }),

      importPoints: (pts) => set(s => {
        if (!Array.isArray(pts)) return;
        pts.forEach((p: any) => {
          const id = p.id || uuidv4();
          const mapId = p.mapId || s.selectedMapId || '';
          const existingIdx = s.points.findIndex(x => x.id === id || (x.mapId === mapId && x.label === p.label && x.x === Number(p.x) && x.y === Number(p.y)));
          const item = {
            id,
            mapId,
            location: p.location || 'Без зоны',
            label: p.label || 'Точка',
            x: Number(p.x) || 0,
            y: Number(p.y) || 0,
            h: Number(p.h) || 0,
            note: p.note || null,
          };
          if (existingIdx >= 0) s.points[existingIdx] = item;
          else s.points.push(item);
        });
      }),

      importGuns: (guns) => set(s => {
        if (!Array.isArray(guns)) return;
        guns.forEach((g: any) => {
          const id = g.id || uuidv4();
          const mapId = g.mapId || s.selectedMapId || '';
          const existingIdx = s.savedGuns.findIndex(x => x.id === id || (x.mapId === mapId && x.name === g.name && x.x === Number(g.x) && x.y === Number(g.y)));
          const item = {
            id,
            name: g.name || 'Огневая',
            mapId,
            x: Number(g.x) || 0,
            y: Number(g.y) || 0,
            h: Number(g.h) || 0,
          };
          if (existingIdx >= 0) s.savedGuns[existingIdx] = item;
          else s.savedGuns.push(item);
        });
      }),

      importMaps: (mapsList) => set(s => {
        if (!Array.isArray(mapsList)) return;
        mapsList.forEach((m: any) => {
          const id = m.id || uuidv4();
          const existingIdx = s.maps.findIndex(x => x.id === id || x.names?.ru === m.names?.ru || x.names?.en === m.names?.en);
          const item = {
            id,
            names: {
              ru: m.names?.ru || m.names?.en || 'Карта',
              en: m.names?.en || m.names?.ru || 'Map',
            },
            gridSquareMeters: Number(m.gridSquareMeters) || 1000,
            widthMeters: m.widthMeters ? Number(m.widthMeters) : null,
            heightMeters: m.heightMeters ? Number(m.heightMeters) : null,
            permanentZones: Array.isArray(m.permanentZones) ? m.permanentZones : [],
          };
          if (existingIdx >= 0) s.maps[existingIdx] = item;
          else s.maps.push(item);
        });
        if (s.maps.length > 0 && !s.selectedMapId) {
          s.selectedMapId = s.maps[0].id;
        }
      }),
    })),
    {
      name: 'rootmortars-v3',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        maps: s.maps, selectedMapId: s.selectedMapId,
        points: s.points, savedGuns: s.savedGuns,
        selectedWeaponId: s.selectedWeaponId, selectedAmmoId: s.selectedAmmoId,
        mortarMode: s.mortarMode, howitzerCharge: s.howitzerCharge,
        gunPos: s.gunPos, targetPos: s.targetPos,
        numpadStep: s.numpadStep, rightTab: s.rightTab,
      }),
    },
  ),
);
