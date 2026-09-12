const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const weapons = readJson('public/data/weapons.json');
const wind = readJson('public/data/wind.json');
const errors = [];

function readJson(relativePath) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
  } catch (error) {
    throw new Error(`${relativePath}: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) errors.push(message);
}

function assertUnique(items, label, getId = item => item.id) {
  const seen = new Set();
  for (const item of items) {
    const id = getId(item);
    assert(id != null && id !== '', `${label}: missing id`);
    assert(!seen.has(id), `${label}: duplicate id ${id}`);
    seen.add(id);
  }
}

function validateRangeTable(table, minRange, maxRange, label) {
  assert(Array.isArray(table) && table.length > 0, `${label}: empty range table`);
  if (!Array.isArray(table) || table.length === 0) return;

  for (let i = 0; i < table.length; i += 1) {
    const row = table[i];
    assert(Number.isFinite(row.range), `${label}[${i}]: invalid range`);
    assert(Number.isFinite(row.elevation), `${label}[${i}]: invalid elevation`);
    assert(row.tof == null || Number.isFinite(row.tof), `${label}[${i}]: invalid TOF`);
    assert(row.dElev == null || Number.isFinite(row.dElev), `${label}[${i}]: invalid dElev`);
    assert(row.angleOfImpact == null || Number.isFinite(row.angleOfImpact), `${label}[${i}]: invalid impact angle`);
    if (i > 0) assert(row.range > table[i - 1].range, `${label}: ranges are not strictly increasing at ${row.range}`);
  }

  assert(table[0].range === minRange, `${label}: minRange ${minRange} != first row ${table[0].range}`);
  assert(table.at(-1).range === maxRange, `${label}: maxRange ${maxRange} != last row ${table.at(-1).range}`);
}

assert(Array.isArray(weapons.weaponSystems), 'weapons.json: weaponSystems must be an array');
assertUnique(weapons.weaponSystems ?? [], 'weaponSystems');

for (const weapon of weapons.weaponSystems ?? []) {
  assert(['mortar', 'howitzer', 'mlrs'].includes(weapon.systemType), `${weapon.id}: invalid systemType`);

  if (weapon.systemType === 'mortar') {
    assertUnique(weapon.ammo ?? [], `${weapon.id}/ammo`);
    for (const ammo of weapon.ammo ?? []) {
      for (const [mode, modeData] of Object.entries(ammo.modes ?? {})) {
        assertUnique(modeData.charges ?? [], `${weapon.id}/${ammo.id}/${mode}/charges`, charge => charge.level);
        for (const charge of modeData.charges ?? []) {
          validateRangeTable(
            charge.rangeTable,
            charge.minRange,
            charge.maxRange,
            `${weapon.id}/${ammo.id}/${mode}/charge-${charge.level}`,
          );
        }
      }
    }
  } else {
    assertUnique(weapon.projectileTypes ?? [], `${weapon.id}/projectileTypes`);
    for (const projectile of weapon.projectileTypes ?? []) {
      const validVariants = weapon.systemType === 'mlrs'
        ? ['low_angle', 'high_angle', 'standard']
        : ['low_angle', 'high_angle'];
      assert(validVariants.includes(projectile.variant), `${weapon.id}/${projectile.id}: invalid variant`);
      validateRangeTable(
        projectile.ballisticTable,
        projectile.minRange,
        projectile.maxRange,
        `${weapon.id}/${projectile.id}`,
      );
    }

    const groupIds = new Set((weapon.projectileTypes ?? []).map(projectile => projectile.name
      .replace(/\s+(low|high)\s+angle\s*$/i, '')
      .replace(/\s+(low|high)\s*$/i, '')
      .replace(/\s+charge\s+\d+\s*$/i, '')
      .trim()));
    assertUnique(weapon.ammoAliases ?? [], `${weapon.id}/ammoAliases`);
    for (const alias of weapon.ammoAliases ?? []) {
      assert(groupIds.has(alias.sourceId), `${weapon.id}/${alias.id}: missing alias source ${alias.sourceId}`);
      assert(!groupIds.has(alias.id), `${weapon.id}/${alias.id}: alias collides with a measured projectile group`);
    }
  }
}

for (const weaponId of ['M252', '2B14']) {
  const weapon = weapons.weaponSystems.find(item => item.id === weaponId);
  assert(Boolean(weapon), `${weaponId}: weapon missing`);
  for (const ammo of weapon?.ammo ?? []) {
    const windCharges = wind.weapons?.[weaponId]?.[ammo.id];
    assert(Array.isArray(windCharges), `${weaponId}/${ammo.id}: wind table missing`);
    for (const charge of ammo.modes.original.charges) {
      const windCharge = windCharges?.find(item => item.ring === charge.level);
      assert(Boolean(windCharge), `${weaponId}/${ammo.id}/charge-${charge.level}: wind charge missing`);
      if (!windCharge) continue;
      assert(windCharge.d === charge.dispersion, `${weaponId}/${ammo.id}/charge-${charge.level}: dispersion mismatch`);
      assert(
        JSON.stringify(windCharge.t.map(row => row.r)) === JSON.stringify(charge.rangeTable.map(row => row.range)),
        `${weaponId}/${ammo.id}/charge-${charge.level}: wind and ballistic ranges differ`,
      );
    }
  }
}

const capturedSources = [
  { weaponId: 'M252', file: 'docs/v1.7-ingame-tables/M252.json', ids: {} },
  {
    weaponId: '2B14',
    file: 'docs/v1.7-ingame-tables/2B14.json',
    ids: { 'O-832DU': '0-832Ay', 'D-832DU': 'A-832AY', 'S-832S': 'C-832C' },
  },
];

for (const source of capturedSources) {
  const captured = readJson(source.file);
  const weapon = weapons.weaponSystems.find(item => item.id === source.weaponId);
  const expectedAmmoIds = captured.ammo.map(ammo => source.ids[ammo.id] ?? ammo.id);
  assert(
    JSON.stringify(weapon?.ammo.map(ammo => ammo.id)) === JSON.stringify(expectedAmmoIds),
    `${source.weaponId}: vanilla ammo list differs from captured v1.7 data`,
  );

  for (const capturedAmmo of captured.ammo) {
    const ammoId = source.ids[capturedAmmo.id] ?? capturedAmmo.id;
    const ammo = weapon?.ammo.find(item => item.id === ammoId);
    for (const capturedCharge of capturedAmmo.charges) {
      const charge = ammo?.modes.original.charges.find(item => item.level === capturedCharge.ring);
      const expectedRows = capturedCharge.rangeTable.map(row => {
        const converted = {
          range: row.range,
          elevation: row.elev,
          tof: row.tof ?? null,
          dElev: row.dElev ?? null,
        };
        if (row.angleOfImpact != null) converted.angleOfImpact = row.angleOfImpact;
        return converted;
      });
      assert(charge?.dispersion === capturedCharge.dispersion, `${source.weaponId}/${ammoId}/charge-${capturedCharge.ring}: captured dispersion differs`);
      assert(
        JSON.stringify(charge?.rangeTable) === JSON.stringify(expectedRows),
        `${source.weaponId}/${ammoId}/charge-${capturedCharge.ring}: ballistic rows differ from captured v1.7 data`,
      );
      const windCharge = wind.weapons?.[source.weaponId]?.[ammoId]?.find(item => item.ring === capturedCharge.ring);
      const expectedWind = capturedCharge.rangeTable.map(row => ({
        r: row.range,
        wc: row.windCross ?? 0,
        wl: row.windLong ?? 0,
      }));
      assert(
        JSON.stringify(windCharge?.t) === JSON.stringify(expectedWind),
        `${source.weaponId}/${ammoId}/charge-${capturedCharge.ring}: wind rows differ from captured v1.7 data`,
      );
    }
  }
}

const m252 = weapons.weaponSystems.find(item => item.id === 'M252');
assert(!m252?.ammo.some(ammo => ammo.id === 'M107'), 'M252: obsolete/non-vanilla M107 must not be present');
const m879 = m252?.ammo.find(ammo => ammo.id === 'M879');
assert(Boolean(m879), 'M252: M879 Practice missing');
assert(Math.max(...(m879?.modes.original.charges ?? []).map(charge => charge.maxRange)) === 2900, 'M252/M879 original max range must be 2900 m');
assert(Math.max(...(m879?.modes.adult_mortars?.charges ?? []).map(charge => charge.maxRange)) === 5800, 'M252/M879 Adult Mortars max range must be 5800 m');

const m777 = weapons.weaponSystems.find(item => item.id === 'M777');
for (const aliasId of ['M107 Airburst', 'M116 Smoke', 'M485A2 Illumination']) {
  assert(m777?.ammoAliases?.some(alias => alias.id === aliasId && alias.sourceId === 'M107 HE'), `M777: missing ${aliasId} alias`);
}

if (errors.length) {
  console.error(`Ballistic data validation failed (${errors.length}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Ballistic data OK: ${weapons.weaponSystems.length} weapons checked.`);
