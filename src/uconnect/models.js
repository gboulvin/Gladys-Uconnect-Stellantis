// -----------------------------------------------------------------------------
// Parsing of the loosely typed API responses into a flat vehicle object.
// Numbers and booleans are often sent as strings, missing values sometimes as
// "null" or "NA": every accessor below returns `null` for those.
// -----------------------------------------------------------------------------

import { supportedCommands } from './commands.js';

function pick(d, ...keys) {
  let v = d;
  for (const key of keys) {
    if (v && typeof v === 'object') {
      v = v[key];
    } else {
      return null;
    }
  }
  return v === undefined || v === 'null' ? null : v;
}

export function getStr(d, ...keys) {
  const v = pick(d, ...keys);
  return v === null || typeof v === 'object' ? null : String(v);
}

export function getNum(d, ...keys) {
  const v = pick(d, ...keys);
  if (v === null || typeof v === 'boolean' || v === '' || typeof v === 'object') {
    return null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function getBool(d, ...keys) {
  const v = pick(d, ...keys);
  if (typeof v === 'boolean') {
    return v;
  }
  if (typeof v === 'string' && ['true', 'false'].includes(v.toLowerCase())) {
    return v.toLowerCase() === 'true';
  }
  return null;
}

/** Whether a string value equals `expected` (case-insensitive), null if unknown. */
export function getEq(d, expected, ...keys) {
  const v = getStr(d, ...keys);
  if (v === null || ['', 'NA'].includes(v.toUpperCase())) {
    return null;
  }
  return v.toUpperCase() === expected.toUpperCase();
}

// Some vehicles report -1 for unavailable values.
const nonNegative = (v) => (v !== null && v >= 0 ? v : null);

const CHARGING_LEVEL_REPORTED = { DEFAULT: 0, LEVEL_1: 1, LEVEL_2: 2, LEVEL_3: 3 };

/** A vehicle with every field known to the integration, all unknown. */
export function emptyVehicle(vin) {
  return {
    vin,
    nickname: null,
    make: null,
    model: null,
    year: null,
    region: null,
    sdp: null,
    imageUrl: null,
    fuelType: null,
    privacyMode: null,
    enabledServices: [],
    supportedCommands: [],

    ignitionOn: null,
    odometer: null,
    odometerUnit: null,
    daysToService: null,
    distanceToService: null,
    distanceToServiceUnit: null,
    distanceToEmpty: null,
    distanceToEmptyUnit: null,
    batteryVoltage: null,
    fuelLow: null,
    fuelAmount: null,
    oilLevel: null,

    pluggedIn: null,
    charging: null,
    chargingLevel: null,
    stateOfCharge: null,
    timeToFullyChargeL1: null,
    timeToFullyChargeL2: null,
    timeToFullyChargeL3: null,

    tyres: {},

    doors: {},
    windows: {},
    trunkLocked: null,
    liftgateLocked: null,
    hvacOn: null,
    hvacTemperature: null,
    hvacTemperatureUnit: null,

    location: null,
    timestampInfo: null,
    timestampStatus: null,
  };
}

/** Update the vehicle from its item of the vehicle list. */
export function applyListItem(v, p) {
  v.nickname = getStr(p, 'nickname');
  v.make = getStr(p, 'make');
  v.model = getStr(p, 'modelDescription') ?? getStr(p, 'model');
  v.year = getNum(p, 'year') ?? getNum(p, 'tsoModelYear');
  v.region = getStr(p, 'soldRegion');
  v.sdp = getStr(p, 'sdp');
  v.imageUrl = getStr(p, 'vehicleImageURL');
  v.fuelType = getStr(p, 'fuelType');
  v.privacyMode = getStr(p, 'privacyMode');

  const services = Array.isArray(p.services) ? p.services : [];
  v.enabledServices = services
    .filter(
      (s) =>
        s &&
        typeof s.service === 'string' &&
        getBool(s, 'vehicleCapable') &&
        getBool(s, 'serviceEnabled'),
    )
    .map((s) => s.service);
  v.supportedCommands = supportedCommands(v.enabledServices);

  // The list may include a status snapshot, used until (or if) the detailed
  // status is loaded.
  if (
    (p.vehicleInfo && typeof p.vehicleInfo === 'object') ||
    (p.phevInfo && typeof p.phevInfo === 'object')
  ) {
    applyVehicleInfo(v, {
      vehicleInfo: p.vehicleInfo,
      evInfo: p.phevInfo,
      timestamp: p.vInfoTimestamp,
    });
  }
  if (p.location && typeof p.location === 'object') {
    applyLocation(v, p.location);
  }
}

/** Update the vehicle from the detailed status (`vehicleInfo` / `evInfo`). */
export function applyVehicleInfo(v, p) {
  const vi = pick(p, 'vehicleInfo');
  const ev = pick(p, 'evInfo');
  const batt = pick(ev, 'battery');

  v.batteryVoltage = getNum(vi, 'batteryInfo', 'batteryVoltage', 'value');
  v.charging = getEq(batt, 'CHARGING', 'chargingStatus');
  v.chargingLevel = CHARGING_LEVEL_REPORTED[getStr(batt, 'chargingLevel') ?? ''] ?? null;
  v.pluggedIn = getBool(batt, 'plugInStatus');
  v.stateOfCharge = getNum(batt, 'stateOfCharge');

  v.daysToService = getNum(vi, 'daysToService');
  v.distanceToService = getNum(vi, 'distanceToService', 'distanceToService', 'value');
  v.distanceToServiceUnit = getStr(vi, 'distanceToService', 'distanceToService', 'unit');

  // The battery range unless missing or zero (combustion engines, PHEVs with
  // an empty battery), then the fuel range.
  const battDte = pick(batt, 'distanceToEmpty');
  const fuelDte = pick(vi, 'fuel', 'distanceToEmpty');
  v.distanceToEmpty = getNum(battDte, 'value') || getNum(fuelDte, 'value');
  v.distanceToEmptyUnit = getStr(battDte, 'unit') ?? getStr(fuelDte, 'unit');

  v.fuelLow = getBool(vi, 'fuel', 'isFuelLevelLow');
  v.fuelAmount = getNum(vi, 'fuel', 'fuelAmountLevel');
  v.oilLevel = getNum(vi, 'oilLevel', 'oilLevel');

  const ignition = getEq(ev, 'ON', 'ignitionStatus');
  if (ignition !== null) {
    v.ignitionOn = ignition;
  }

  v.timeToFullyChargeL1 = nonNegative(getNum(batt, 'timeToFullyChargeL1'));
  v.timeToFullyChargeL2 = nonNegative(getNum(batt, 'timeToFullyChargeL2'));
  v.timeToFullyChargeL3 = nonNegative(getNum(batt, 'timeToFullyChargeL3'));

  v.odometer = getNum(vi, 'odometer', 'odometer', 'value');
  v.odometerUnit = getStr(vi, 'odometer', 'odometer', 'unit');

  const tyres = pick(vi, 'tyrePressure');
  if (Array.isArray(tyres)) {
    v.tyres = {};
    for (const [position, type] of TYRE_POSITIONS) {
      const tyre = tyres.find((t) => t?.type === type);
      if (tyre) {
        v.tyres[position] = {
          pressure: getNum(tyre, 'pressure', 'value'),
          unit: getStr(tyre, 'pressure', 'unit'),
          warning: getBool(tyre, 'warning'),
        };
      }
    }
  }

  const timestamp = getNum(p, 'timestamp');
  if (timestamp !== null) {
    v.timestampInfo = timestamp;
  }
}

export const TYRE_POSITIONS = [
  ['front_left', 'FL'],
  ['front_right', 'FR'],
  ['rear_left', 'RL'],
  ['rear_right', 'RR'],
];

const DOORS = [
  ['driver', 'driver'],
  ['passenger', 'passenger'],
  ['rear_left', 'leftRear'],
  ['rear_right', 'rightRear'],
];

const WINDOWS = [...DOORS, ['sunroof', 'sunroof']];

/** Update the vehicle from the remote status (doors, windows, engine...). */
export function applyRemoteStatus(v, p) {
  if (p.doors) {
    v.doors = {};
    for (const [name, key] of DOORS) {
      v.doors[name] = getEq(p, 'LOCKED', 'doors', key, 'status');
    }
  }
  if (p.windows) {
    v.windows = {};
    for (const [name, key] of WINDOWS) {
      v.windows[name] = getEq(p, 'CLOSED', 'windows', key, 'status');
    }
  }
  if (p.engine) {
    v.ignitionOn = getEq(p, 'ON', 'engine', 'status');
  }
  v.trunkLocked = getEq(p, 'LOCKED', 'trunk', 'status');
  v.liftgateLocked = getEq(p, 'LOCKED', 'liftGate', 'status');
  v.hvacOn = getEq(p, 'ON', 'hvac', 'status');
  v.hvacTemperature = getNum(p, 'hvac', 'temperature', 'value');
  v.hvacTemperatureUnit = getStr(p, 'hvac', 'temperature', 'unit');
  v.timestampStatus = getNum(p, 'timestamp');
}

/** Update the vehicle from its last known location. */
export function applyLocation(v, p) {
  const latitude = getNum(p, 'latitude');
  const longitude = getNum(p, 'longitude');
  v.location =
    latitude === null || longitude === null
      ? null
      : {
          latitude,
          longitude,
          approximate: getBool(p, 'isLocationApprox'),
          updated: getNum(p, 'timeStamp'),
        };
}

// ----------------------------------------------------------------------------
// Derived values, shared by the device features, the triggers and widgets.
// ----------------------------------------------------------------------------

/** Whether the vehicle has a traction battery (BEV, PHEV, hybrid). */
export function isElectrified(v) {
  return ['E', 'H', 'P'].includes((v.fuelType ?? '').toUpperCase()) || v.stateOfCharge !== null;
}

/** `true` all known doors locked, `false` one unlocked, `null` unknown. */
export function allDoorsLocked(v) {
  const known = Object.values(v.doors).filter((s) => s !== null);
  return known.length === 0 ? null : known.every(Boolean);
}

/** `true` one window open, `false` all known closed, `null` unknown. */
export function anyWindowOpen(v) {
  const known = Object.values(v.windows).filter((s) => s !== null);
  return known.length === 0 ? null : known.some((closed) => !closed);
}

/** Minutes until fully charged, for the charger the vehicle reports. */
export function timeToFullCharge(v) {
  const byLevel = {
    1: v.timeToFullyChargeL1,
    2: v.timeToFullyChargeL2,
    3: v.timeToFullyChargeL3,
  };
  if (!v.charging) {
    return v.charging === false ? 0 : null;
  }
  return byLevel[v.chargingLevel] ?? null;
}

/** Wheels whose tyre pressure warning is on. */
export function tyreWarnings(v) {
  return Object.entries(v.tyres)
    .filter(([, t]) => t.warning === true)
    .map(([position]) => position);
}

/** Display name: nickname, else make + model, else VIN. */
export function displayName(v) {
  if (v.nickname) {
    return v.nickname;
  }
  const name = [v.make, v.model].filter(Boolean).join(' ');
  return name || v.vin;
}
