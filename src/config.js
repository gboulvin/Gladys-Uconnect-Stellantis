// -----------------------------------------------------------------------------
// Integration configuration.
//
// Filled in by the user in Gladys from the `config_schema` of the manifest;
// the SDK fetches it (`gladys.getConfig()`) and notifies every change
// (`gladys.onConfigUpdated()`). This module provides the defaults and
// normalizes the received object, so the rest of the code never deals with
// `undefined` or numbers sent as strings.
// -----------------------------------------------------------------------------

import { BRANDS, DEFAULT_BRAND } from './uconnect/brands.js';

// Defaults: they MUST match the `default` values of the manifest config_schema
// (checked by test/manifest.test.js).
export const DEFAULT_CONFIG = {
  brand: DEFAULT_BRAND,
  email: '',
  password: '',
  pin: '',
  // Minutes between two reads of the Uconnect cloud.
  refresh_interval: 5,
  // State of charge (%) under which the `battery_low` scene trigger fires.
  low_battery_threshold: 20,
  temperature_unit: 'celsius',
  // Target temperature sent with "start the climate", until changed from the
  // target temperature feature of a vehicle.
  climate_temperature: 21,
  // Wait for the vehicle to confirm a command before answering (up to 75 s).
  wait_for_confirmation: true,
};

const MIN_REFRESH_INTERVAL = 2;
const MAX_REFRESH_INTERVAL = 240;

function clamp(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, n));
}

/**
 * Merge the user config with the defaults.
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const config = { ...DEFAULT_CONFIG, ...raw };
  return {
    ...config,
    brand: BRANDS[config.brand] ? config.brand : DEFAULT_BRAND,
    email: String(config.email ?? '').trim(),
    password: String(config.password ?? ''),
    pin: String(config.pin ?? '').trim(),
    refresh_interval: clamp(
      config.refresh_interval,
      MIN_REFRESH_INTERVAL,
      MAX_REFRESH_INTERVAL,
      DEFAULT_CONFIG.refresh_interval,
    ),
    low_battery_threshold: clamp(
      config.low_battery_threshold,
      0,
      100,
      DEFAULT_CONFIG.low_battery_threshold,
    ),
    temperature_unit: config.temperature_unit === 'fahrenheit' ? 'fahrenheit' : 'celsius',
    climate_temperature: clamp(
      config.climate_temperature,
      10,
      90,
      DEFAULT_CONFIG.climate_temperature,
    ),
    wait_for_confirmation: config.wait_for_confirmation !== false,
  };
}

/** Whether the account credentials are filled in. */
export function isConfigured(config) {
  return Boolean(config.email && config.password);
}
