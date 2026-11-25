// -----------------------------------------------------------------------------
// Scene actions (SDK v0.14+, Gladys 5.1+).
//
// Each action is declared in the manifest `scene_actions` field and handled
// here under the same key; index.js registers them with
// `gladys.onSceneAction(key, ...)`. The handlers receive the RESOLVED fields
// (scene variables substituted, `"source": "devices"` = the chosen device
// external_id) and resolve the declared scalar `outputs`.
//
// A scene action is never a condition: an unsupported command or a failure
// reported by the vehicle is an output (`success: false`, `status`), so the
// scene author gates the next actions on it. A missing PIN or an unreachable
// cloud throws: the scene logs it and continues.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { COMMAND_STATUS, userError } from './service.js';
import { t } from './i18n.js';
import { allDoorsLocked } from './uconnect/models.js';
import { VEHICLE_COMMANDS } from './uconnect/commands.js';

const logger = createLogger({ name: 'scenes' });

export const SCENE_ACTION_KEYS = {
  SEND_COMMAND: 'send_command',
  REFRESH_VEHICLE: 'refresh_vehicle',
  SEND_DESTINATION: 'send_destination',
};

function requireVehicle(service, device) {
  const vehicle = service.resolveVehicle(device);
  if (!vehicle) {
    throw userError(t('unknown_vehicle'));
  }
  return vehicle;
}

const toNumber = (value) =>
  value === undefined || value === null || value === '' ? undefined : Number(value);

/** Scalar outputs describing a vehicle, for the following scene actions. */
export function vehicleOutputs(vehicle) {
  const outputs = {
    battery_level: vehicle.stateOfCharge,
    range: vehicle.distanceToEmpty,
    odometer: vehicle.odometer,
    fuel_level: vehicle.fuelAmount,
    locked: allDoorsLocked(vehicle),
    charging: vehicle.charging,
    plugged: vehicle.pluggedIn,
    latitude: vehicle.location?.latitude,
    longitude: vehicle.location?.longitude,
  };
  // Unknown values are left out rather than sent as null.
  return Object.fromEntries(
    Object.entries(outputs).filter(([, v]) => v !== null && v !== undefined),
  );
}

export function createSceneActions(service) {
  return {
    async [SCENE_ACTION_KEYS.SEND_COMMAND]({ device, command, temperature }) {
      logger.info(`Scene action send_command <- ${command} on ${device}`);
      if (!VEHICLE_COMMANDS[command]) {
        throw new Error(`Unknown command ${command}`);
      }
      const vehicle = requireVehicle(service, device);
      const { status } = await service.runCommand(vehicle, command, {
        temperature: toNumber(temperature),
      });
      return { success: status === COMMAND_STATUS.SUCCESS, status };
    },

    async [SCENE_ACTION_KEYS.REFRESH_VEHICLE]({ device }) {
      logger.info(`Scene action refresh_vehicle <- ${device ?? 'first vehicle'}`);
      await service.refresh();
      return vehicleOutputs(requireVehicle(service, device));
    },

    async [SCENE_ACTION_KEYS.SEND_DESTINATION]({ device, latitude, longitude, name }) {
      logger.info(`Scene action send_destination <- ${device}`);
      const vehicle = requireVehicle(service, device);
      const lat = Number(latitude);
      const lon = Number(longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        throw new Error('latitude and longitude must be numbers');
      }
      const { status } = await service.sendDestination(vehicle, {
        latitude: lat,
        longitude: lon,
        name: name || undefined,
      });
      return { success: status !== COMMAND_STATUS.FAILED };
    },
  };
}
