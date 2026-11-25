// -----------------------------------------------------------------------------
// A VehicleService wired to the fake Gladys of the SDK and the in-memory
// Uconnect cloud: what index.js does, minus the WebSocket.
// -----------------------------------------------------------------------------

import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { normalizeConfig } from '../../src/config.js';
import { VehicleService } from '../../src/service.js';
import { UconnectClient } from '../../src/uconnect/client.js';
import { createFakeCloud, imageFetch } from './fake-cloud.js';

export const CONFIG = {
  brand: 'fiat_eu',
  email: 'me@example.com',
  password: 'secret',
  pin: '1234',
};

/**
 * @param {object} [options]
 * @param {object} [options.config] - Raw config overrides.
 * @param {object} [options.cloud] - createFakeCloud() options.
 */
export async function setup({ config = {}, cloud: cloudOptions } = {}) {
  const gladys = createFakeGladys();
  const cloud = createFakeCloud(cloudOptions);
  const service = new VehicleService({
    gladys,
    fetch: imageFetch,
    createClient: (options) =>
      new UconnectClient({ ...options, fetch: cloud.fetch, sleep: async () => {} }),
  });
  await service.configure(normalizeConfig({ ...CONFIG, ...config }));
  service.stop();
  return { gladys, cloud, service };
}

/** The feature external id of a vehicle feature. */
export const featureId = (gladys, vin, key) => gladys.externalIds('vehicle', vin).feature(key);

/** The device external id of a vehicle. */
export const deviceId = (gladys, vin) => gladys.externalIds('vehicle', vin).device;
