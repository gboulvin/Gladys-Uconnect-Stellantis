// -----------------------------------------------------------------------------
// Remote commands that can be sent to a vehicle.
//
// A command is POSTed as `{ command, pinAuth, params? }` to
// `/<apiVersion>/accounts/<uid>/vehicles/<vin>/<url>`; the API answers with a
// correlation id used to poll for the result. A vehicle supports a command
// when one of its enabling services is enabled for it. Routing follows the
// official apps: the eight classic commands use `/v1/.../remote/`, the other
// remote operations `/v2/.../remote/`.
// -----------------------------------------------------------------------------

function command(name, { url = 'remote/', apiVersion = 'v1', fallback, services } = {}) {
  return { name, url, apiVersion, fallback, services: services ?? [name] };
}

const DEEP_REFRESH_V2_ALT = command('DEEPREFRESH2', { url: 'ev/', apiVersion: 'v2' });
const DEEP_REFRESH_V2 = command('DEEPREFRESH', {
  url: 'ev/',
  apiVersion: 'v2',
  fallback: DEEP_REFRESH_V2_ALT,
});
const CHARGE_V4 = command('START_CHARGE', { url: 'ev/chargenow/', apiVersion: 'v4' });

export const API_COMMANDS = {
  RDL: command('RDL'),
  RDU: command('RDU'),
  REON: command('REON'),
  REOFF: command('REOFF'),
  HBLF: command('HBLF'),
  ROLIGHTS: command('ROLIGHTS'),
  ROPRECOND: command('ROPRECOND'),
  ROPRECOND_OFF: command('ROPRECOND_OFF'),
  ROHVACON: command('ROHVACON', { apiVersion: 'v2' }),
  ROHVACOFF: command('ROHVACOFF', { apiVersion: 'v2' }),
  ROCOMFORTON: command('ROCOMFORTON', { apiVersion: 'v2' }),
  ROCOMFORTOFF: command('ROCOMFORTOFF', { apiVersion: 'v2' }),
  ACV: command('ACV', { apiVersion: 'v2' }),
  ROTRUNKLOCK: command('ROTRUNKLOCK', { apiVersion: 'v2' }),
  ROTRUNKUNLOCK: command('ROTRUNKUNLOCK', { apiVersion: 'v2' }),
  ROLIFTGATELOCK: command('ROLIFTGATELOCK', { apiVersion: 'v2' }),
  ROLIFTGATEUNLOCK: command('ROLIFTGATEUNLOCK', { apiVersion: 'v2' }),
  VF: command('VF', { url: 'location/' }),
  DEEPREFRESH: command('DEEPREFRESH', {
    url: 'ev/',
    fallback: DEEP_REFRESH_V2,
    services: ['DEEPREFRESH', 'DEEPREFRESH2'],
  }),
  CNOW: command('CNOW', {
    url: 'ev/chargenow/',
    fallback: CHARGE_V4,
    services: ['CNOW', 'CNOW2'],
  }),
};

/**
 * Commands as offered to Gladys users (manifest `command` selects, widget
 * buttons, device features). The keys are stored in scenes: never rename one.
 * `api` lists the API commands that can serve it, in order of preference
 * (the first one the vehicle supports is sent).
 */
export const VEHICLE_COMMANDS = {
  lock: { api: ['RDL'] },
  unlock: { api: ['RDU'] },
  climate_on: { api: ['ROHVACON', 'ROPRECOND', 'ROCOMFORTON'], climate: true },
  climate_off: { api: ['ROHVACOFF', 'ROPRECOND_OFF', 'ROCOMFORTOFF'] },
  engine_on: { api: ['REON', 'ROPRECOND'] },
  engine_off: { api: ['REOFF', 'ROPRECOND_OFF'] },
  lights_horn: { api: ['HBLF'] },
  lights: { api: ['ROLIGHTS', 'HBLF'] },
  charge_now: { api: ['CNOW'] },
  cabin_ventilation: { api: ['ACV'] },
  trunk_lock: { api: ['ROTRUNKLOCK'] },
  trunk_unlock: { api: ['ROTRUNKUNLOCK'] },
  liftgate_lock: { api: ['ROLIFTGATELOCK'] },
  liftgate_unlock: { api: ['ROLIFTGATEUNLOCK'] },
  refresh_location: { api: ['VF'] },
  deep_refresh: { api: ['DEEPREFRESH'] },
};

/** Whether a set of enabled services enables an API command. */
export function isEnabled(apiCommand, services) {
  return apiCommand.services.some((s) => services.includes(s));
}

/**
 * The API command to send for a Gladys command key, `null` when the vehicle
 * supports none of its variants. Also picks the newer endpoint variants the
 * way the official apps do (CNOW2 -> START_CHARGE v4, DEEPREFRESH2 -> v2).
 */
export function resolveCommand(key, services) {
  const definition = VEHICLE_COMMANDS[key];
  if (!definition) {
    return null;
  }
  const name = definition.api.find((n) => isEnabled(API_COMMANDS[n], services));
  if (!name) {
    return null;
  }
  if (name === 'CNOW' && services.includes('CNOW2')) {
    return CHARGE_V4;
  }
  if (name === 'DEEPREFRESH' && services.includes('DEEPREFRESH2')) {
    return DEEP_REFRESH_V2;
  }
  return API_COMMANDS[name];
}

/** Gladys command keys the vehicle supports. */
export function supportedCommands(services) {
  return Object.keys(VEHICLE_COMMANDS).filter((key) => resolveCommand(key, services) !== null);
}

/**
 * `params` of ROHVACON setting the target temperature. The values besides the
 * target are the ones the official app sends.
 */
export function hvacParams(targetTemp, unit = 'celsius') {
  const celsius = unit !== 'fahrenheit';
  return {
    interiorTemperature: celsius ? 22 : 72,
    temperatureUOM: celsius ? 'Celsius' : 'Fahrenheit',
    fanSpeed: 50,
    targetTemp,
    timeoutAfterTemp: 0,
    preTripTimeout: 15,
  };
}
