// -----------------------------------------------------------------------------
// Manifest actions: the buttons of the Configuration screen (manifest
// `actions` field). The resolved multi-language message is shown under the
// button; a thrown error shows its message instead.
// -----------------------------------------------------------------------------

import { t } from './i18n.js';
import { isConfigured } from './config.js';
import { userError } from './service.js';
import { displayName } from './uconnect/models.js';
import { VEHICLE_COMMANDS } from './uconnect/commands.js';

export const ACTION_KEYS = {
  TEST_CONNECTION: 'test_connection',
  REFRESH: 'refresh',
  SEND_COMMAND: 'send_command',
};

export function createActions(service) {
  return {
    async [ACTION_KEYS.TEST_CONNECTION]() {
      if (!service.config || !isConfigured(service.config)) {
        throw userError(t('not_configured'));
      }
      // A test is an explicit user request: retry even after a refused login.
      service.authFailed = false;
      if (!(await service.refresh())) {
        throw userError(service.authFailed ? t('auth_failed') : t('cloud_unreachable'));
      }
      const vehicles = service.vehicles;
      if (vehicles.length === 0) {
        return t('connection_no_vehicle');
      }
      return t('connection_ok', {
        count: vehicles.length,
        names: vehicles.map(displayName).join(', '),
      });
    },

    async [ACTION_KEYS.REFRESH]() {
      if (!(await service.refresh())) {
        throw userError(service.authFailed ? t('auth_failed') : t('cloud_unreachable'));
      }
      return t('refresh_done');
    },

    async [ACTION_KEYS.SEND_COMMAND]({ device, command }) {
      if (!VEHICLE_COMMANDS[command]) {
        throw new Error(`Unknown command ${command}`);
      }
      const vehicle = service.resolveVehicle(device);
      const { message } = await service.runCommand(vehicle, command);
      return message;
    },
  };
}
