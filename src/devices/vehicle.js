// -----------------------------------------------------------------------------
// Device type: VEHICLE
//
// One Gladys device per vehicle of the Uconnect account, keyed by its VIN.
// The features depend on the vehicle: an electric Fiat 500e gets its battery
// and charging features, a Jeep Wrangler its fuel level, and the controllable
// features (lock, climate, engine, lights & horn) only appear when the vehicle
// supports the matching remote command.
//
// Feature keys are stored by Gladys (history, scenes, dashboards): never
// rename one. A feature, once seen for a vehicle, stays in its discovery
// payload even if a later refresh misses the data (see VehicleService).
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as C,
  DEVICE_FEATURE_TYPES as T,
  DEVICE_FEATURE_UNITS as U,
} from '@gladysassistant/integration-sdk';
import { isUsMarket } from '../uconnect/brands.js';
import {
  allDoorsLocked,
  anyWindowOpen,
  displayName,
  isElectrified,
  timeToFullCharge,
} from '../uconnect/models.js';

export const DEVICE_TYPE = 'vehicle';

const DISTANCE_UNITS = { km: U.KM, mi: U.MILE, mile: U.MILE, miles: U.MILE };
const PRESSURE_UNITS = { kpa: U.KILO_PASCAL, bar: U.BAR, psi: U.PSI };
const MAX_PRESSURE = { [U.KILO_PASCAL]: 1000, [U.BAR]: 10, [U.PSI]: 150 };

const binary = (v) => (v === null || v === undefined ? null : v ? 1 : 0);
const round = (v, digits = 0) =>
  v === null || v === undefined ? null : Math.round(v * 10 ** digits) / 10 ** digits;

function distanceUnit(unit, ctx) {
  return DISTANCE_UNITS[(unit ?? '').toLowerCase()] ?? (ctx.usMarket ? U.MILE : U.KM);
}

function tyreUnit(vehicle, ctx) {
  const unit = Object.values(vehicle.tyres).find((t) => t.unit)?.unit;
  return PRESSURE_UNITS[(unit ?? '').toLowerCase()] ?? (ctx.usMarket ? U.PSI : U.KILO_PASCAL);
}

const supports = (vehicle, ...commands) =>
  commands.every((c) => vehicle.supportedCommands.includes(c));

/** Feature keys, as stored by Gladys. */
export const FEATURE = {
  BATTERY_LEVEL: 'battery-level',
  RANGE: 'range',
  ODOMETER: 'odometer',
  CHARGING: 'charging',
  PLUGGED: 'plugged',
  CHARGE_TIME: 'charge-time-remaining',
  LOCK: 'lock',
  CLIMATE: 'climate',
  TARGET_TEMPERATURE: 'target-temperature',
  CABIN_TEMPERATURE: 'cabin-temperature',
  ENGINE: 'engine',
  LIGHTS_HORN: 'lights-horn',
  WINDOW_OPENED: 'window-opened',
  FUEL_LEVEL: 'fuel-level',
  BATTERY_12V: 'battery-12v-voltage',
  DAYS_TO_SERVICE: 'days-to-service',
  TYRE_FRONT_LEFT: 'tyre-pressure-front-left',
  TYRE_FRONT_RIGHT: 'tyre-pressure-front-right',
  TYRE_REAR_LEFT: 'tyre-pressure-rear-left',
  TYRE_REAR_RIGHT: 'tyre-pressure-rear-right',
};

const TYRE_FEATURES = [
  [FEATURE.TYRE_FRONT_LEFT, 'front_left', 'Tyre pressure front left'],
  [FEATURE.TYRE_FRONT_RIGHT, 'front_right', 'Tyre pressure front right'],
  [FEATURE.TYRE_REAR_LEFT, 'rear_left', 'Tyre pressure rear left'],
  [FEATURE.TYRE_REAR_RIGHT, 'rear_right', 'Tyre pressure rear right'],
];

/**
 * Every feature a vehicle can have.
 *   - available(vehicle, ctx): whether this vehicle gets the feature;
 *   - read(vehicle, ctx): the state to publish (`null` = unknown, skipped);
 *   - command(value) (writable features): the VEHICLE_COMMANDS key to send.
 * `ctx` carries `{ usMarket, config, targetTemperature }`.
 */
export const FEATURES = [
  {
    key: FEATURE.BATTERY_LEVEL,
    name: 'Battery level',
    category: C.ELECTRICAL_VEHICLE_BATTERY,
    type: T.ELECTRICAL_VEHICLE_BATTERY.BATTERY_LEVEL,
    unit: () => U.PERCENT,
    min: 0,
    max: 100,
    available: (v) => isElectrified(v),
    read: (v) => round(v.stateOfCharge),
  },
  {
    key: FEATURE.RANGE,
    name: 'Range',
    category: C.ELECTRICAL_VEHICLE_BATTERY,
    type: T.ELECTRICAL_VEHICLE_BATTERY.BATTERY_RANGE_ESTIMATE,
    unit: (v, ctx) => distanceUnit(v.distanceToEmptyUnit, ctx),
    min: 0,
    max: 2000,
    available: (v) => v.distanceToEmpty !== null || isElectrified(v),
    read: (v) => round(v.distanceToEmpty),
  },
  {
    key: FEATURE.ODOMETER,
    name: 'Odometer',
    category: C.ELECTRICAL_VEHICLE_STATE,
    type: T.ELECTRICAL_VEHICLE_STATE.ODOMETER,
    unit: (v, ctx) => distanceUnit(v.odometerUnit, ctx),
    min: 0,
    max: 2000000,
    available: () => true,
    read: (v) => round(v.odometer),
  },
  {
    key: FEATURE.CHARGING,
    name: 'Charging',
    category: C.ELECTRICAL_VEHICLE_CHARGE,
    type: T.ELECTRICAL_VEHICLE_CHARGE.CHARGE_ON,
    min: 0,
    max: 1,
    available: (v) => isElectrified(v),
    read: (v) => binary(v.charging),
  },
  {
    key: FEATURE.PLUGGED,
    name: 'Plugged in',
    category: C.ELECTRICAL_VEHICLE_CHARGE,
    type: T.ELECTRICAL_VEHICLE_CHARGE.PLUGGED,
    min: 0,
    max: 1,
    available: (v) => isElectrified(v),
    read: (v) => binary(v.pluggedIn),
  },
  {
    key: FEATURE.CHARGE_TIME,
    name: 'Time to full charge',
    category: C.DURATION,
    type: T.DURATION.INTEGER,
    unit: () => U.MINUTES,
    min: 0,
    max: 6000,
    available: (v) => isElectrified(v),
    read: (v) => timeToFullCharge(v),
  },
  {
    key: FEATURE.LOCK,
    name: 'Doors locked',
    category: C.ELECTRICAL_VEHICLE_COMMAND,
    type: T.ELECTRICAL_VEHICLE_COMMAND.LOCK,
    min: 0,
    max: 1,
    writable: (v) => supports(v, 'lock', 'unlock'),
    available: (v) => supports(v, 'lock', 'unlock') || Object.keys(v.doors).length > 0,
    read: (v) => binary(allDoorsLocked(v)),
    command: (value) => (value ? 'lock' : 'unlock'),
  },
  {
    key: FEATURE.CLIMATE,
    name: 'Climate',
    category: C.ELECTRICAL_VEHICLE_CLIMATE,
    type: T.ELECTRICAL_VEHICLE_CLIMATE.CLIMATE_ON,
    min: 0,
    max: 1,
    writable: (v) => supports(v, 'climate_on', 'climate_off'),
    available: (v) => supports(v, 'climate_on', 'climate_off') || v.hvacOn !== null,
    read: (v) => binary(v.hvacOn),
    command: (value) => (value ? 'climate_on' : 'climate_off'),
  },
  {
    key: FEATURE.TARGET_TEMPERATURE,
    name: 'Climate target temperature',
    category: C.ELECTRICAL_VEHICLE_CLIMATE,
    type: T.ELECTRICAL_VEHICLE_CLIMATE.TARGET_TEMPERATURE,
    unit: (v, ctx) => (ctx.config.temperature_unit === 'fahrenheit' ? U.FAHRENHEIT : U.CELSIUS),
    min: (ctx) => (ctx.config.temperature_unit === 'fahrenheit' ? 60 : 16),
    max: (ctx) => (ctx.config.temperature_unit === 'fahrenheit' ? 84 : 28),
    writable: () => true,
    // Only the HVAC command takes a target temperature.
    available: (v) => v.enabledServices.includes('ROHVACON'),
    read: (v, ctx) => ctx.targetTemperature,
  },
  {
    key: FEATURE.CABIN_TEMPERATURE,
    name: 'Cabin temperature',
    category: C.ELECTRICAL_VEHICLE_CLIMATE,
    type: T.ELECTRICAL_VEHICLE_CLIMATE.INDOOR_TEMPERATURE,
    unit: (v) =>
      (v.hvacTemperatureUnit ?? 'C').toUpperCase().startsWith('F') ? U.FAHRENHEIT : U.CELSIUS,
    min: -40,
    max: 120,
    available: (v) => v.hvacTemperature !== null,
    read: (v) => round(v.hvacTemperature, 1),
  },
  {
    key: FEATURE.ENGINE,
    name: 'Engine (remote start)',
    category: C.SWITCH,
    type: T.SWITCH.BINARY,
    min: 0,
    max: 1,
    writable: () => true,
    available: (v) => v.enabledServices.includes('REON') && v.enabledServices.includes('REOFF'),
    read: (v) => binary(v.ignitionOn),
    command: (value) => (value ? 'engine_on' : 'engine_off'),
  },
  {
    key: FEATURE.LIGHTS_HORN,
    name: 'Lights and horn',
    category: C.ELECTRICAL_VEHICLE_COMMAND,
    type: T.ELECTRICAL_VEHICLE_COMMAND.ALARM,
    min: 0,
    max: 1,
    writable: () => true,
    hasFeedback: false,
    available: (v) => supports(v, 'lights_horn') || supports(v, 'lights'),
    // A one-shot action: always at rest.
    read: () => 0,
    command: (value, v) => (value ? (supports(v, 'lights_horn') ? 'lights_horn' : 'lights') : null),
  },
  {
    key: FEATURE.WINDOW_OPENED,
    name: 'Window open',
    category: C.ELECTRICAL_VEHICLE_STATE,
    type: T.ELECTRICAL_VEHICLE_STATE.WINDOW_OPENED,
    min: 0,
    max: 1,
    available: (v) => Object.keys(v.windows).length > 0,
    read: (v) => binary(anyWindowOpen(v)),
  },
  {
    key: FEATURE.FUEL_LEVEL,
    name: 'Fuel level',
    category: C.LEVEL_SENSOR,
    type: T.LEVEL_SENSOR.LIQUID_LEVEL_PERCENT,
    unit: () => U.PERCENT,
    min: 0,
    max: 100,
    available: (v) => v.fuelAmount !== null,
    read: (v) => round(v.fuelAmount),
  },
  {
    key: FEATURE.BATTERY_12V,
    name: '12 V battery voltage',
    category: C.ELECTRICAL_VEHICLE_BATTERY,
    type: T.ELECTRICAL_VEHICLE_BATTERY.BATTERY_VOLTAGE,
    unit: () => U.VOLT,
    min: 0,
    max: 20,
    available: (v) => v.batteryVoltage !== null,
    read: (v) => round(v.batteryVoltage, 2),
  },
  {
    key: FEATURE.DAYS_TO_SERVICE,
    name: 'Days to next service',
    category: C.DURATION,
    type: T.DURATION.INTEGER,
    unit: () => U.DAYS,
    min: -3650,
    max: 3650,
    available: (v) => v.daysToService !== null,
    read: (v) => round(v.daysToService),
  },
  ...TYRE_FEATURES.map(([key, position, name]) => ({
    key,
    name,
    category: C.ELECTRICAL_VEHICLE_STATE,
    type: T.ELECTRICAL_VEHICLE_STATE.TIRE_PRESSURE,
    unit: (v, ctx) => tyreUnit(v, ctx),
    min: 0,
    max: (ctx, v) => MAX_PRESSURE[tyreUnit(v, ctx)],
    available: (v) => v.tyres[position] !== undefined,
    read: (v) => {
      const pressure = v.tyres[position]?.pressure ?? null;
      return pressure === null ? null : round(pressure, tyreUnit(v, {}) === U.KILO_PASCAL ? 0 : 2);
    },
  })),
];

export const FEATURES_BY_KEY = Object.fromEntries(FEATURES.map((f) => [f.key, f]));

/** Context shared by the feature callbacks. */
export function featureContext(config, brand, targetTemperature) {
  return { usMarket: isUsMarket(brand), config, targetTemperature };
}

/** Keys of the features a vehicle has right now. */
export function availableFeatureKeys(vehicle, ctx) {
  return FEATURES.filter((f) => f.available(vehicle, ctx)).map((f) => f.key);
}

const resolve = (value, ctx, vehicle) =>
  typeof value === 'function' ? value(ctx, vehicle) : value;

/**
 * The discovery payload of a vehicle.
 * @param {object} gladys - SDK instance (external ids).
 * @param {object} vehicle - Parsed vehicle (uconnect/models.js).
 * @param {string[]} featureKeys - Features to declare (see availableFeatureKeys).
 * @param {object} ctx - featureContext().
 */
export function buildVehicleDevice(gladys, vehicle, featureKeys, ctx) {
  const ids = gladys.externalIds(DEVICE_TYPE, vehicle.vin);
  return {
    name: displayName(vehicle),
    external_id: ids.device,
    features: FEATURES.filter((f) => featureKeys.includes(f.key)).map((f) => {
      const writable = typeof f.writable === 'function' && f.writable(vehicle, ctx);
      const feature = {
        name: f.name,
        external_id: ids.feature(f.key),
        category: f.category,
        type: f.type,
        min: resolve(f.min, ctx, vehicle),
        max: resolve(f.max, ctx, vehicle),
        read_only: !writable,
        has_feedback: writable ? f.hasFeedback !== false : false,
        keep_history: true,
      };
      if (f.unit) {
        feature.unit = f.unit(vehicle, ctx);
      }
      return feature;
    }),
  };
}

/** The states to publish for a vehicle (unknown values are skipped). */
export function vehicleStates(gladys, vehicle, featureKeys, ctx) {
  const ids = gladys.externalIds(DEVICE_TYPE, vehicle.vin);
  return FEATURES.filter((f) => featureKeys.includes(f.key))
    .map((f) => ({ device_feature_external_id: ids.feature(f.key), state: f.read(vehicle, ctx) }))
    .filter(({ state }) => state !== null && state !== undefined && Number.isFinite(state));
}

/** VIN and feature key of a feature external id, `null` when not ours. */
export function parseFeatureExternalId(gladys, externalId) {
  const prefix = gladys.externalIds(DEVICE_TYPE, '').device;
  if (!externalId?.startsWith(prefix)) {
    return null;
  }
  const rest = externalId.slice(prefix.length);
  const featureKey = FEATURES.map((f) => f.key).find((key) => rest.endsWith(`:${key}`));
  if (!featureKey) {
    return null;
  }
  return { vin: rest.slice(0, -(featureKey.length + 1)), featureKey };
}

/** VIN of a device external id, `null` when not ours. */
export function vinOfDevice(gladys, externalId) {
  const prefix = gladys.externalIds(DEVICE_TYPE, '').device;
  if (!externalId?.startsWith(prefix)) {
    return null;
  }
  const vin = externalId.slice(prefix.length);
  return vin && !vin.includes(':') ? vin : null;
}
