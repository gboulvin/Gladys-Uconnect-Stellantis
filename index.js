// -----------------------------------------------------------------------------
// Entry point of the Uconnect (Stellantis) integration for Gladys Assistant.
//
// This file only wires the SDK to the vehicle service (src/service.js):
//   1. instantiates the SDK (connection, auth, reconnection: handled by it);
//   2. registers every handler BEFORE connect();
//   3. connects, reads the config and starts the periodic cloud refresh.
//
// The Gladys supervisor injects GLADYS_HOST_API_URL, GLADYS_INTEGRATION_TOKEN
// and GLADYS_INTEGRATION_SELECTOR: `new GladysIntegration()` reads them.
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from './src/config.js';
import { parseFeatureExternalId } from './src/devices/vehicle.js';
import { createActions } from './src/actions.js';
import { createSceneActions } from './src/scenes.js';
import { VehicleService } from './src/service.js';
import { createWidgets, refreshWidgets } from './src/widgets.js';

const gladys = new GladysIntegration();

let widgets = {};
const service = new VehicleService({
  gladys,
  // Open dashboards follow every refresh instead of waiting for their TTL.
  onRefreshed: () => refreshWidgets(gladys, widgets),
});
widgets = createWidgets(service);

// --- Discovery: Gladys asks for the list of devices --------------------------
gladys.onScanRequest(async () => {
  logger.info('onScanRequest -> refreshing the vehicles');
  await service.refresh();
  await gladys.publishDiscoveredDevices(service.discoveredDevices());
});

// --- Command: the user acts on a controllable feature ------------------------
gladys.onSetValue(async (device, feature, value) => {
  logger.info(`onSetValue <- ${feature.external_id} = ${value}`);
  const parsed = parseFeatureExternalId(gladys, feature.external_id);
  if (!parsed) {
    throw new Error(`Unknown feature ${feature.external_id}`);
  }
  await service.setValue(feature.external_id, parsed.featureKey, parsed.vin, value);
});

// --- Manifest actions: buttons of the Configuration screen ------------------
const actions = createActions(service);
for (const [key, handler] of Object.entries(actions)) {
  gladys.onAction(key, async (fields) => {
    try {
      return await handler(fields ?? {});
    } catch (err) {
      // The message shown under the button, in the user's language.
      if (err.userMessage) {
        return err.userMessage;
      }
      throw err;
    }
  });
}

// --- Scene actions -----------------------------------------------------------
// The handlers resolve the declared outputs; a thrown error (English message)
// fails this action only, the scene logs it and continues.
for (const [key, handler] of Object.entries(createSceneActions(service))) {
  gladys.onSceneAction(key, (fields) => handler(fields ?? {}));
}

// --- Dashboard widgets -------------------------------------------------------
for (const [key, widget] of Object.entries(widgets)) {
  gladys.onWidgetGet(key, (request) => widget.get(request ?? {}));
  if (typeof widget.action === 'function') {
    gladys.onWidgetAction(key, (actionKey, params, { settings } = {}) =>
      widget.action({ actionKey, params: params ?? {}, settings }),
    );
  }
}
gladys.onWidgetGetImage((imageKey) => service.imageBase64(imageKey));

// --- Configuration updated by the user ---------------------------------------
gladys.onConfigUpdated(async (newConfig) => {
  logger.info('onConfigUpdated -> new configuration received');
  await service.configure(normalizeConfig(newConfig));
  refreshWidgets(gladys, widgets);
});

// --- Connection lifecycle ----------------------------------------------------
gladys.on('connected', async () => {
  try {
    await service.configure(normalizeConfig(await gladys.getConfig()));
    // The nudges sent while the socket was down were dropped.
    refreshWidgets(gladys, widgets);
  } catch (err) {
    logger.error('Post-connection initialization failed', err);
    await gladys
      .setConnectionStatus(false, {
        en: 'Initialization failed, check the integration logs.',
        fr: "L'initialisation a échoué, consultez les logs de l'intégration.",
        de: 'Die Initialisierung ist fehlgeschlagen, prüfen Sie die Logs der Integration.',
        es: 'La inicialización ha fallado, consulte los registros de la integración.',
      })
      .catch(() => {});
  }
});

gladys.on('disconnected', () => {
  service.stop();
});

// --- Graceful shutdown -------------------------------------------------------
gladys.handleShutdown((signal) => {
  logger.info(`Received ${signal} -> graceful shutdown`);
  service.stop();
});

// --- Startup -----------------------------------------------------------------
logger.info('Starting the Uconnect (Stellantis) integration...');
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
