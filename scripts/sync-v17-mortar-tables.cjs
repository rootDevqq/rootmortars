const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const weaponsPath = path.join(root, 'public', 'data', 'weapons.json');
const docsWeaponsPath = path.join(root, 'docs', 'weapons.json');
const windPath = path.join(root, 'public', 'data', 'wind.json');

const weapons = JSON.parse(fs.readFileSync(weaponsPath, 'utf8'));
const wind = JSON.parse(fs.readFileSync(windPath, 'utf8'));

const sources = [
  {
    weaponId: 'M252',
    file: path.join(root, 'docs', 'v1.7-ingame-tables', 'M252.json'),
    ids: {},
  },
  {
    weaponId: '2B14',
    file: path.join(root, 'docs', 'v1.7-ingame-tables', '2B14.json'),
    ids: {
      'O-832DU': '0-832Ay',
      'D-832DU': 'A-832AY',
      'S-832S': 'C-832C',
    },
  },
];

function convertRow(row) {
  const converted = {
    range: row.range,
    elevation: row.elev,
    tof: row.tof ?? null,
    dElev: row.dElev ?? null,
  };
  if (row.angleOfImpact != null) converted.angleOfImpact = row.angleOfImpact;
  return converted;
}

for (const source of sources) {
  const captured = JSON.parse(fs.readFileSync(source.file, 'utf8'));
  const weapon = weapons.weaponSystems.find(item => item.id === source.weaponId);
  if (!weapon) throw new Error(`Missing weapon ${source.weaponId}`);

  // M107 belonged to an old third-party M252 dataset and is not a vanilla
  // Arma Reforger mortar round. M107 for the M777 is a separate projectile.
  if (source.weaponId === 'M252') {
    weapon.ammo = weapon.ammo.filter(ammo => ammo.id !== 'M107');
  }

  wind.weapons[source.weaponId] = {};

  for (const capturedAmmo of captured.ammo) {
    const ammoId = source.ids[capturedAmmo.id] ?? capturedAmmo.id;
    const ammo = weapon.ammo.find(item => item.id === ammoId);
    if (!ammo) throw new Error(`Missing ammo ${source.weaponId}/${ammoId}`);

    ammo.modes.original = {
      charges: capturedAmmo.charges.map(charge => ({
        level: charge.ring,
        minRange: charge.rangeTable[0].range,
        maxRange: charge.rangeTable.at(-1).range,
        dispersion: charge.dispersion,
        rangeTable: charge.rangeTable.map(convertRow),
      })),
    };

    wind.weapons[source.weaponId][ammoId] = capturedAmmo.charges.map(charge => ({
      ring: charge.ring,
      d: charge.dispersion,
      t: charge.rangeTable.map(row => ({
        r: row.range,
        wc: row.windCross ?? 0,
        wl: row.windLong ?? 0,
      })),
    }));
  }
}

const m777 = weapons.weaponSystems.find(item => item.id === 'M777');
if (!m777) throw new Error('Missing weapon M777');
m777.ammoAliases = [
  { id: 'M107 Airburst', name: 'M107 Airburst', sourceId: 'M107 HE' },
  { id: 'M116 Smoke', name: 'M116 Smoke', sourceId: 'M107 HE' },
  { id: 'M485A2 Illumination', name: 'M485A2 Illumination', sourceId: 'M107 HE' },
];

weapons.generated = '2026-09-12';
weapons.conventions.heightCorrection = 'M252, 2Б14 и M777: по углу падения и локальному наклону таблицы; Adult Mortars без угла падения использует dElev. Остальные гаубицы/РСЗО высоту игнорируют.';
const sittSource = weapons.sources.find(source => source.name.includes('skszone01/mortar'));
if (sittSource) {
  sittSource.covers = 'миномёты M252 и 2Б14: режим Adult Mortars, все снаряды и кольца';
  sittSource.note = 'Adult Mortars сверено с локальными игровыми скриншотами; ванильные таблицы берутся из отдельных захватов v1.7';
}
const captureSource = {
  name: 'In-game Ballistic Table captures (Arma Reforger 1.7)',
  covers: 'ванильные M252 и 2Б14: возвышение, TOF, угол падения, ветер и разброс',
  note: 'локальные данные docs/v1.7-ingame-tables/M252.json и 2B14.json',
};
const captureIndex = weapons.sources.findIndex(source => source.name === captureSource.name);
if (captureIndex >= 0) weapons.sources[captureIndex] = captureSource;
else weapons.sources.unshift(captureSource);
wind.version = '1.7.0.54';
wind.note = 'Wind corrections per 10 m/s, transcribed from the in-game Arma Reforger 1.7 ballistic tables. Scale linearly: actual = value * (windSpeed / 10).';

const serializedWeapons = `${JSON.stringify(weapons, null, 2)}\n`;
fs.writeFileSync(weaponsPath, serializedWeapons);
fs.writeFileSync(docsWeaponsPath, serializedWeapons);
fs.writeFileSync(windPath, `${JSON.stringify(wind, null, 2)}\n`);

console.log('Synced vanilla M252/2B14 tables, wind data, and M777 projectile aliases.');
