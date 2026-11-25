// -----------------------------------------------------------------------------
// The vehicle service: owns the Uconnect client, refreshes the account at the
// configured interval, and turns each refresh into Gladys calls — discovered
// devices, changed states, scene events, transport badges, widget nudges. The
// SDK handlers of index.js, the scene actions and the widgets all go through
// it.
// -----------------------------------------------------------------------------

import { createLogger, DEVICE_TRANSPORTS } from '@gladysassistant/integration-sdk';
import {
  availableFeatureKeys,
  buildVehicleDevice,
  DEVICE_TYPE,
  FEATURE,
  FEATURES_BY_KEY,
  featureContext,
  vehicleStates,
  vinOfDevice,
} from './devices/vehicle.js';
import { COMMAND_LABELS, t } from './i18n.js';
import { detectEvents, mergeSnapshot } from './triggers.js';
import { isConfigured } from './config.js';
import { getBrand } from './uconnect/brands.js';
import { UconnectClient } from './uconnect/client.js';
import { resolveCommand } from './uconnect/commands.js';
import { UconnectAuthError, UconnectPinError } from './uconnect/http.js';
import { displayName } from './uconnect/models.js';

const logger = createLogger({ name: 'uconnect' });

// Unchanged values are re-sent this often, so they stay recently dated.
const STATE_HEARTBEAT_MS = 60 * 60 * 1000;
// After a confirmed command, the vehicle needs a moment to upload its state.
const POST_COMMAND_REFRESH_MS = 20_000;
// How long a command waits for the vehicle to confirm it: within the 120 s
// granted to a scene action or a widget button, login and PIN included.
const COMMAND_TIMEOUT_MS = 75_000;
// Largest picture the core accepts for a widget image.
const MAX_IMAGE_BYTES = 300 * 1024;

/** Command outcome statuses, also the `status` output of the scene action. */
export const COMMAND_STATUS = {
  SUCCESS: 'success',
  SENT: 'sent',
  FAILED: 'failed',
  UNSUPPORTED: 'unsupported',
};

export class VehicleService {
  /**
   * @param {object} options
   * @param {object} options.gladys - SDK instance.
   * @param {(options: object) => UconnectClient} [options.createClient] - Injected in tests.
   * @param {typeof fetch} [options.fetch] - Used to download vehicle pictures.
   * @param {() => void} [options.onRefreshed] - Called after every refresh (widget nudges).
   */
  constructor({
    gladys,
    createClient = (o) => new UconnectClient(o),
    fetch = globalThis.fetch,
    onRefreshed,
  }) {
    this.gladys = gladys;
    this.createClient = createClient;
    this.fetch = fetch;
    this.onRefreshed = onRefreshed ?? (() => {});
    this.config = null;
    this.client = null;
    this.credentialsKey = null;
    this.timer = null;
    this.refreshing = null;
    this.lastError = null;
    this.lastRefresh = null;
    this.authFailed = false;
    /** @type {Map<string, Set<string>>} features declared per VIN */
    this.featureKeys = new Map();
    /** @type {Map<string, object>} trigger snapshots per VIN */
    this.snapshots = new Map();
    /** @type {Map<string, number>} climate target temperature per VIN */
    this.targetTemperatures = new Map();
    /** @type {Map<string, string>} last discovery payload per VIN (JSON) */
    this.publishedDevices = new Map();
    /** @type {Map<string, { key: string, vin: string, url: string }>} */
    this.images = new Map();
    this.imageBytes = new Map();
    /** Background commands started by setValue (awaited by the tests). */
    this.pendingCommands = new Set();
  }

  get brand() {
    return getBrand(this.config?.brand);
  }

  get vehicles() {
    return this.client ? [...this.client.vehicles.values()] : [];
  }

  /** Apply a (new) configuration: re-create the client if the account changed. */
  async configure(config) {
    const previous = this.config;
    this.config = config;
    const key = JSON.stringify([config.brand, config.email, config.password]);
    if (key !== this.credentialsKey) {
      this.credentialsKey = key;
      this.client = isConfigured(config)
        ? this.createClient({
            brand: config.brand,
            email: config.email,
            password: config.password,
            pin: config.pin,
          })
        : null;
      this.featureKeys.clear();
      this.snapshots.clear();
      this.publishedDevices.clear();
      this.images.clear();
      this.imageBytes.clear();
    } else if (this.client && previous?.pin !== config.pin) {
      this.client.api.pin = config.pin || null;
      this.client.api.pinTokens.clear();
    }
    // Saving the configuration (or reconnecting to Gladys) is a deliberate
    // event: a refused login may be retried once.
    this.authFailed = false;
    this.schedule();
    if (!this.client) {
      await this.gladys.setConnectionStatus(false, t('not_configured'));
      return;
    }
    await this.refresh();
  }

  /** (Re)start the periodic refresh at the configured interval. */
  schedule() {
    this.stop();
    if (!this.client) {
      return;
    }
    this.timer = setInterval(() => {
      this.refresh().catch((err) => logger.error('Periodic refresh failed', err));
    }, this.config.refresh_interval * 60_000);
    this.timer.unref?.();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Refresh every vehicle and publish the result. Concurrent calls share the
   * running refresh. Resolves `true` on success; never rejects for a cloud
   * error, which is reported through the connection status instead.
   */
  refresh() {
    if (!this.refreshing) {
      this.refreshing = this.doRefresh().finally(() => {
        this.refreshing = null;
      });
    }
    return this.refreshing;
  }

  async doRefresh() {
    if (!this.client) {
      return false;
    }
    if (this.authFailed) {
      // Retrying a refused password every few minutes could lock the
      // account: wait for the user to fix the configuration.
      return false;
    }
    try {
      await this.client.refresh();
    } catch (err) {
      this.lastError = err;
      if (err instanceof UconnectAuthError) {
        this.authFailed = true;
        logger.error(`Uconnect login refused: ${err.message}`);
        await this.gladys.setConnectionStatus(false, t('auth_failed'));
      } else {
        logger.warn(`Uconnect refresh failed: ${err.message}`);
        await this.gladys.setConnectionStatus(false, t('cloud_unreachable'));
        await this.publishTransports(true);
      }
      return false;
    }
    this.lastError = null;
    this.lastRefresh = Date.now();
    await this.publishVehicles();
    await this.gladys.setConnectionStatus(true);
    this.onRefreshed();
    return true;
  }

  ctx(vin) {
    return featureContext(this.config, this.brand, this.targetTemperature(vin));
  }

  targetTemperature(vin) {
    return this.targetTemperatures.get(vin) ?? this.config.climate_temperature;
  }

  /** Features declared for a vehicle: once seen, a feature stays. */
  featuresOf(vehicle) {
    const keys = this.featureKeys.get(vehicle.vin) ?? new Set();
    for (const key of availableFeatureKeys(vehicle, this.ctx(vehicle.vin))) {
      keys.add(key);
    }
    this.featureKeys.set(vehicle.vin, keys);
    return [...keys];
  }

  /** Discovery payload of every vehicle of the account. */
  discoveredDevices() {
    return this.vehicles.map((v) =>
      buildVehicleDevice(this.gladys, v, this.featuresOf(v), this.ctx(v.vin)),
    );
  }

  async publishVehicles() {
    const devices = this.discoveredDevices();
    // The discovery list only needs re-publishing when it changed.
    const changedDevices = devices.some(
      (d) => this.publishedDevices.get(d.external_id) !== JSON.stringify(d),
    );
    if (changedDevices || this.publishedDevices.size !== devices.length) {
      await this.gladys.publishDiscoveredDevices(devices);
      this.publishedDevices = new Map(devices.map((d) => [d.external_id, JSON.stringify(d)]));
    }

    const states = this.vehicles.flatMap((v) =>
      vehicleStates(this.gladys, v, this.featuresOf(v), this.ctx(v.vin)),
    );
    if (states.length > 0) {
      await this.gladys.publishChangedStates(states, { heartbeat: STATE_HEARTBEAT_MS });
    }

    for (const vehicle of this.vehicles) {
      const deviceId = this.deviceExternalId(vehicle.vin);
      const previous = this.snapshots.get(vehicle.vin);
      for (const { key, data } of detectEvents(previous, vehicle, deviceId, this.config)) {
        logger.info(`Scene event ${key} for ${vehicle.vin}`);
        await this.gladys
          .publishSceneEvent(key, data)
          .catch((err) => logger.error(`publishSceneEvent ${key} failed`, err));
      }
      this.snapshots.set(vehicle.vin, mergeSnapshot(previous, vehicle));
    }
    await this.publishTransports(false);
  }

  /**
   * The cloud badge of every vehicle: `cloud`, degraded when the last refresh
   * failed (the values are from an older one) or when the privacy mode of
   * the vehicle blocks its data.
   */
  async publishTransports(stale) {
    const entries = this.vehicles.map((v) => {
      const entry = {
        external_id: this.deviceExternalId(v.vin),
        transport: DEVICE_TRANSPORTS.CLOUD,
      };
      if (stale) {
        return { ...entry, degraded: true, message: t('degraded_stale') };
      }
      if ((v.privacyMode ?? '').toUpperCase() === 'ACTIVE') {
        return { ...entry, degraded: true, message: t('privacy_mode') };
      }
      return entry;
    });
    if (entries.length > 0) {
      await this.gladys
        .publishTransports(entries)
        .catch((err) => logger.error('publishTransports failed', err));
    }
  }

  deviceExternalId(vin) {
    return this.gladys.externalIds(DEVICE_TYPE, vin).device;
  }

  /** The vehicle of a device external id, `null` when unknown. */
  vehicleOfDevice(externalId) {
    const vin = vinOfDevice(this.gladys, externalId);
    return (vin && this.client?.vehicles.get(vin)) || null;
  }

  /**
   * The vehicle a widget or a scene targets: the chosen device, or the only
   * (first) vehicle of the account when none is chosen.
   */
  resolveVehicle(externalId) {
    if (externalId) {
      return this.vehicleOfDevice(externalId);
    }
    return this.vehicles[0] ?? null;
  }

  /**
   * Send a command (VEHICLE_COMMANDS key) and, if configured, wait for the
   * vehicle to confirm it.
   * @returns {Promise<{ status: string, message: object }>} Never rejects for
   *   an unsupported command or a failure reported by the vehicle; rejects
   *   (with a translated `userMessage`) for a missing or refused PIN, an
   *   unknown vehicle or a cloud error.
   */
  async runCommand(vehicle, key, { temperature } = {}) {
    if (!vehicle || !this.client) {
      throw userError(t('unknown_vehicle'));
    }
    const vars = { vehicle: displayName(vehicle), command: COMMAND_LABELS[key] ?? key };
    if (!resolveCommand(key, vehicle.enabledServices)) {
      return { status: COMMAND_STATUS.UNSUPPORTED, message: t('command_unsupported', vars) };
    }
    const target =
      temperature ?? (key === 'climate_on' ? this.targetTemperature(vehicle.vin) : undefined);
    let cid;
    try {
      cid = await this.client.command(vehicle.vin, key, {
        temperature: target,
        temperatureUnit: this.config.temperature_unit,
      });
    } catch (err) {
      throw translateError(err);
    }
    logger.info(`Command ${key} sent to ${vehicle.vin}`);
    if (!this.config.wait_for_confirmation) {
      this.refreshSoon();
      return { status: COMMAND_STATUS.SENT, message: t('command_sent', vars) };
    }
    const result = await this.client.waitForOperation(vehicle.vin, cid, {
      timeoutMs: COMMAND_TIMEOUT_MS,
    });
    this.refreshSoon();
    if (result === true) {
      return { status: COMMAND_STATUS.SUCCESS, message: t('command_success', vars) };
    }
    if (result === false) {
      return { status: COMMAND_STATUS.FAILED, message: t('command_failed', vars) };
    }
    return { status: COMMAND_STATUS.SENT, message: t('command_sent', vars) };
  }

  /** Send a destination to the vehicle navigation system. */
  async sendDestination(vehicle, destination) {
    if (!vehicle || !this.client) {
      throw userError(t('unknown_vehicle'));
    }
    try {
      await this.client.sendDestination(vehicle.vin, destination);
    } catch (err) {
      throw translateError(err);
    }
    return {
      status: COMMAND_STATUS.SENT,
      message: t('destination_sent', { vehicle: displayName(vehicle) }),
    };
  }

  /** Refresh again once the vehicle had time to upload its new state. */
  refreshSoon(delayMs = POST_COMMAND_REFRESH_MS) {
    const timer = setTimeout(() => {
      this.refresh().catch((err) => logger.error('Refresh after command failed', err));
    }, delayMs);
    timer.unref?.();
  }

  /**
   * `onSetValue`: a user acted on a writable feature.
   */
  async setValue(featureExternalId, featureKey, vin, value) {
    const vehicle = this.client?.vehicles.get(vin);
    if (!vehicle) {
      throw userError(t('unknown_vehicle'));
    }
    if (featureKey === FEATURE.TARGET_TEMPERATURE) {
      this.targetTemperatures.set(vin, Number(value));
      await this.gladys.publishState(featureExternalId, Number(value));
      return;
    }
    const feature = FEATURES_BY_KEY[featureKey];
    const on = Number(value) === 1;
    const command = feature?.command?.(on, vehicle);
    if (!command) {
      throw new Error(`Feature ${featureKey} cannot be set to ${value}`);
    }
    const vars = { vehicle: displayName(vehicle), command: COMMAND_LABELS[command] };
    if (!resolveCommand(command, vehicle.enabledServices)) {
      throw userError(t('command_unsupported', vars));
    }
    if (!this.config.pin) {
      throw userError(t('pin_required'));
    }
    // Gladys awaits a device command for 5 s only, while a vehicle takes up
    // to a minute to confirm one: the command runs in the background, and
    // the confirmed state (or the actual one, on failure) is published when
    // the vehicle answers.
    const done = this.runCommand(vehicle, command)
      .then(async ({ status, message }) => {
        if (status === COMMAND_STATUS.SUCCESS && featureKey !== FEATURE.LIGHTS_HORN) {
          await this.gladys.publishState(featureExternalId, on ? 1 : 0);
        } else if (status !== COMMAND_STATUS.SUCCESS && status !== COMMAND_STATUS.SENT) {
          logger.warn(message.en);
        }
      })
      .catch((err) => {
        logger.error(`Command ${command} on ${vehicle.vin} failed: ${err.message}`);
        this.refreshSoon(0);
      });
    this.pendingCommands.add(done);
    done.finally(() => this.pendingCommands.delete(done));
    if (featureKey === FEATURE.LIGHTS_HORN) {
      // A one-shot action: back at rest straight away.
      await this.gladys.publishState(featureExternalId, 0);
    }
  }

  // --- Vehicle pictures (widgets) ---------------------------------------

  /**
   * Image key of the picture of a vehicle, `null` when it has none. The key
   * changes with the picture URL: the core caches an image one hour by key.
   */
  async imageKey(vehicle) {
    const cached = [...this.images.values()].find((i) => i.vin === vehicle.vin);
    if (cached) {
      return cached.key;
    }
    const url = await this.client.vehicleImageUrl(vehicle.vin).catch(() => null);
    if (!url) {
      return null;
    }
    const key = `vehicle-${hash(`${vehicle.vin}|${url}`)}`;
    this.images.set(key, { key, vin: vehicle.vin, url });
    return key;
  }

  /** `onWidgetGetImage`: the raw base64 of a vehicle picture. */
  async imageBase64(key) {
    if (this.imageBytes.has(key)) {
      return this.imageBytes.get(key);
    }
    const image = this.images.get(key);
    if (!image) {
      throw new Error(`Unknown image ${key}`);
    }
    const response = await this.fetch(image.url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      throw new Error(`Vehicle picture: HTTP ${response.status}`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > MAX_IMAGE_BYTES) {
      throw new Error('Vehicle picture larger than 300 KB');
    }
    const base64 = bytes.toString('base64');
    this.imageBytes.set(key, base64);
    return base64;
  }
}

function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** An Error carrying a translated message for the user. */
export function userError(message) {
  const err = new Error(message.en);
  err.userMessage = message;
  return err;
}

function translateError(err) {
  if (err instanceof UconnectPinError) {
    return userError(err.message.includes('required') ? t('pin_required') : t('pin_refused'));
  }
  if (err instanceof UconnectAuthError) {
    return userError(t('auth_failed'));
  }
  return err;
}
