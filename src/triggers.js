// -----------------------------------------------------------------------------
// Scene triggers (SDK v0.14+, Gladys 5.1+).
//
// After every refresh, the new state of each vehicle is compared with the
// previous one, and every TRANSITION fires one event with
// `gladys.publishSceneEvent(key, data)`: "the car started charging", "the
// doors were unlocked", "the battery dropped under 20 %". The first refresh
// after a (re)start only records the state: a restart is not an event.
//
// Every key is declared in the manifest `scene_triggers` field (checked by
// test/manifest.test.js); `data` only carries the keys declared there as
// `fields` (filters) or `variables`, flat and primitive.
// -----------------------------------------------------------------------------

import { allDoorsLocked, displayName, tyreWarnings } from './uconnect/models.js';

export const TRIGGERS = {
  CHARGING: 'charging_state_changed',
  PLUG: 'plug_state_changed',
  LOCK: 'lock_state_changed',
  IGNITION: 'ignition_state_changed',
  BATTERY_LOW: 'battery_low',
  TYRE_WARNING: 'tyre_pressure_warning',
  LOCATION: 'location_changed',
};

export const SCENE_TRIGGER_KEYS = Object.values(TRIGGERS);

// A new location closer than this to the previous one is GPS noise, not a move.
export const MIN_MOVE_METERS = 200;

/** Great-circle distance between two points, in meters. */
export function distanceMeters(a, b) {
  const rad = (deg) => (deg * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/**
 * The part of a vehicle the triggers compare, kept between two refreshes.
 */
export function snapshot(vehicle) {
  return {
    charging: vehicle.charging,
    pluggedIn: vehicle.pluggedIn,
    locked: allDoorsLocked(vehicle),
    ignitionOn: vehicle.ignitionOn,
    stateOfCharge: vehicle.stateOfCharge,
    tyreWarnings: tyreWarnings(vehicle),
    location: vehicle.location ? { ...vehicle.location } : null,
  };
}

// Both sides known and different: a transition (unknown -> known is not one).
const changed = (before, after) =>
  before !== null &&
  before !== undefined &&
  after !== null &&
  after !== undefined &&
  before !== after;

/**
 * Scene events between two snapshots of the same vehicle.
 * @param {object|undefined} previous - snapshot() of the last refresh.
 * @param {object} vehicle - The freshly refreshed vehicle.
 * @param {string} deviceExternalId - Value of the `device` filter.
 * @param {object} config - Normalized config (battery threshold).
 * @returns {{ key: string, data: object }[]}
 */
export function detectEvents(previous, vehicle, deviceExternalId, config) {
  if (!previous) {
    return [];
  }
  const current = snapshot(vehicle);
  const base = { device: deviceExternalId, vehicle: displayName(vehicle) };
  const withBattery = (data) =>
    current.stateOfCharge === null
      ? data
      : { ...data, battery_level: Math.round(current.stateOfCharge) };
  const events = [];

  if (changed(previous.charging, current.charging)) {
    events.push({
      key: TRIGGERS.CHARGING,
      data: withBattery({ ...base, state: current.charging ? 'started' : 'stopped' }),
    });
  }
  if (changed(previous.pluggedIn, current.pluggedIn)) {
    events.push({
      key: TRIGGERS.PLUG,
      data: withBattery({ ...base, state: current.pluggedIn ? 'plugged' : 'unplugged' }),
    });
  }
  if (changed(previous.locked, current.locked)) {
    events.push({
      key: TRIGGERS.LOCK,
      data: { ...base, state: current.locked ? 'locked' : 'unlocked' },
    });
  }
  if (changed(previous.ignitionOn, current.ignitionOn)) {
    events.push({
      key: TRIGGERS.IGNITION,
      data: { ...base, state: current.ignitionOn ? 'on' : 'off' },
    });
  }

  const threshold = config.low_battery_threshold;
  if (
    previous.stateOfCharge !== null &&
    current.stateOfCharge !== null &&
    previous.stateOfCharge >= threshold &&
    current.stateOfCharge < threshold
  ) {
    events.push({
      key: TRIGGERS.BATTERY_LOW,
      data: { ...base, battery_level: Math.round(current.stateOfCharge), threshold },
    });
  }

  for (const wheel of current.tyreWarnings) {
    if (!previous.tyreWarnings.includes(wheel)) {
      events.push({ key: TRIGGERS.TYRE_WARNING, data: { ...base, wheel } });
    }
  }

  if (previous.location && current.location) {
    const distance = distanceMeters(previous.location, current.location);
    if (distance >= MIN_MOVE_METERS) {
      events.push({
        key: TRIGGERS.LOCATION,
        data: {
          ...base,
          latitude: current.location.latitude,
          longitude: current.location.longitude,
          distance: Math.round(distance),
        },
      });
    }
  }
  return events;
}

/**
 * The snapshot to keep for the next comparison. A value the API did not
 * return this time keeps the previous one, so "unknown" never hides a
 * transition: charging -> unknown -> stopped still fires "stopped".
 */
export function mergeSnapshot(previous, vehicle) {
  const current = snapshot(vehicle);
  if (!previous) {
    return current;
  }
  const merged = { ...current };
  for (const key of [
    'charging',
    'pluggedIn',
    'locked',
    'ignitionOn',
    'stateOfCharge',
    'location',
  ]) {
    if (current[key] === null || current[key] === undefined) {
      merged[key] = previous[key];
    }
  }
  return merged;
}
