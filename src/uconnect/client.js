// -----------------------------------------------------------------------------
// High-level Uconnect client: keeps the parsed vehicles of the account and
// runs the remote commands, waiting for their result.
// -----------------------------------------------------------------------------

import { UconnectApi } from './api.js';
import { getBrand } from './brands.js';
import { hvacParams, resolveCommand, VEHICLE_COMMANDS } from './commands.js';
import { UconnectApiError, UconnectCommandError } from './http.js';
import {
  applyListItem,
  applyLocation,
  applyRemoteStatus,
  applyVehicleInfo,
  emptyVehicle,
  getStr,
} from './models.js';

const OPERATION_SUCCEEDED = ['success', 'succeeded', 'completed', 'complete'];
const OPERATION_FAILED = ['failure', 'failed', 'error', 'rejected', 'timeout'];

function operationResult(status) {
  if (!status) {
    return null;
  }
  const s = status.toLowerCase();
  if (OPERATION_SUCCEEDED.includes(s)) {
    return true;
  }
  if (OPERATION_FAILED.includes(s)) {
    return false;
  }
  return null;
}

function notificationResult(r, cid) {
  const items = r?.notifications?.items;
  for (const item of Array.isArray(items) ? items : []) {
    if (item?.correlationId === cid) {
      const result = operationResult(getStr(item, 'notification', 'data', 'status'));
      if (result !== null) {
        return result;
      }
    }
  }
  return null;
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class UconnectClient {
  /**
   * @param {object} options - See UconnectApi, plus `brand` as a config key
   *   and an injectable `sleep` (tests).
   */
  constructor({ brand, email, password, pin, fetch, timeoutMs, sleep = defaultSleep }) {
    this.api = new UconnectApi({
      brand: typeof brand === 'string' ? getBrand(brand) : brand,
      email,
      password,
      pin,
      fetch,
      timeoutMs,
    });
    this.sleep = sleep;
    /** @type {Map<string, object>} vehicles by VIN */
    this.vehicles = new Map();
  }

  /**
   * Load the vehicles of the account and their state. Endpoints a vehicle
   * does not support fail with an API error and are skipped: the vehicle
   * keeps the data that is available. Other errors (auth, network) reject.
   */
  async refresh() {
    const items = (await this.api.listVehicles()).filter((x) => x?.vin);
    await Promise.all(items.map((item) => this.refreshVehicle(item)));
    const vins = new Set(items.map((x) => x.vin));
    for (const vin of this.vehicles.keys()) {
      if (!vins.has(vin)) {
        this.vehicles.delete(vin);
      }
    }
    return this.vehicles;
  }

  async refreshVehicle(item) {
    const vehicle = this.vehicles.get(item.vin) ?? emptyVehicle(item.vin);
    applyListItem(vehicle, item);
    const { vin } = vehicle;

    const [info, location, remote] = await Promise.allSettled([
      this.api.getVehicleInfo(vin, vehicle.enabledServices.includes('CPCOOP') ? 'v4' : 'v3'),
      this.api.getLocation(vin),
      this.api.getRemoteStatus(vin),
    ]);
    for (const result of [info, location, remote]) {
      if (result.status === 'rejected' && !(result.reason instanceof UconnectApiError)) {
        throw result.reason;
      }
    }
    if (info.status === 'fulfilled') {
      applyVehicleInfo(vehicle, info.value);
    }
    if (location.status === 'fulfilled') {
      applyLocation(vehicle, location.value);
    }
    if (remote.status === 'fulfilled') {
      applyRemoteStatus(vehicle, remote.value);
    }
    this.vehicles.set(vin, vehicle);
    return vehicle;
  }

  /**
   * Send a Gladys command (VEHICLE_COMMANDS key) to a vehicle and resolve
   * its correlation id.
   * @param {string} vin
   * @param {string} key - e.g. `lock`, `climate_on`.
   * @param {{ temperature?: number, temperatureUnit?: string }} [options]
   */
  async command(vin, key, { temperature, temperatureUnit } = {}) {
    const vehicle = this.vehicles.get(vin);
    if (!vehicle) {
      throw new UconnectCommandError(`unknown vehicle ${vin}`);
    }
    const apiCommand = resolveCommand(key, vehicle.enabledServices);
    if (!apiCommand) {
      throw new UconnectCommandError(`command ${key} is not supported by ${vin}`);
    }
    let params;
    if (
      VEHICLE_COMMANDS[key].climate &&
      apiCommand.name === 'ROHVACON' &&
      Number.isFinite(temperature)
    ) {
      params = hvacParams(temperature, temperatureUnit);
    }
    return this.api.command(vin, apiCommand, params);
  }

  /**
   * Wait for a remote operation to finish: `true` succeeded, `false` failed,
   * `null` no result within the timeout. The result is polled from the
   * operation status endpoints (the apps use one for commands, another for
   * the other operations) and from the vehicle notifications, as they are
   * not available everywhere. An endpoint answering 404 is not polled again.
   */
  async waitForOperation(vin, cid, { timeoutMs = 60_000, intervalMs = 3_000 } = {}) {
    const endpoints = [
      (v, c) => this.api.getRemoteOperationLastStatus(v, c),
      (v, c) => this.api.getRemoteOperationStatus(v, c),
    ];
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      await this.sleep(intervalMs);
      for (const endpoint of [...endpoints]) {
        try {
          const r = await endpoint(vin, cid);
          const result = operationResult(getStr(r, 'status') ?? getStr(r, 'responseStatus'));
          if (result !== null) {
            return result;
          }
        } catch (err) {
          if (!(err instanceof UconnectApiError)) {
            throw err;
          }
          if (err.status === 404) {
            endpoints.splice(endpoints.indexOf(endpoint), 1);
          }
        }
      }
      try {
        const result = notificationResult(await this.api.getVehicleNotifications(vin), cid);
        if (result !== null) {
          return result;
        }
      } catch (err) {
        if (!(err instanceof UconnectApiError)) {
          throw err;
        }
      }
      if (Date.now() + intervalMs >= deadline) {
        return null;
      }
    }
  }

  /** Send a destination to the vehicle navigation, resolve the correlation id. */
  sendDestination(vin, destination) {
    return this.api.sendDestination(vin, destination);
  }

  /** URL of a rendered picture of the vehicle, `null` when there is none. */
  async vehicleImageUrl(vin) {
    try {
      const r = await this.api.getVehicleImage(vin);
      const url = r?.items?.[0]?.preciseImageURL;
      if (typeof url === 'string' && url.startsWith('https://')) {
        return url;
      }
    } catch (err) {
      if (!(err instanceof UconnectApiError)) {
        throw err;
      }
    }
    const fallback = this.vehicles.get(vin)?.imageUrl;
    return fallback?.startsWith('https://') ? fallback : null;
  }
}
