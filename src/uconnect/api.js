// -----------------------------------------------------------------------------
// Low-level client of the Uconnect cloud API: each method maps to one
// endpoint and resolves the decoded JSON. Paths, methods and bodies follow the
// official apps, as documented by the py-uconnect project.
// -----------------------------------------------------------------------------

import { expiresSoon, login } from './auth.js';
import {
  apiHeaders,
  parseJson,
  send,
  UconnectApiError,
  UconnectCommandError,
  UconnectPinError,
} from './http.js';
import { sign } from './sigv4.js';

// Versions of the vehicle status endpoint: v4 for vehicles with the CPCOOP
// service, v3 otherwise.
const STATUS_API_VERSIONS = ['v3', 'v4'];

// Service delivery platform used in the PIN path when the vehicle reports none.
const DEFAULT_SDP = 'ignite';

// A cached PIN token is renewed this long before it expires.
const PIN_TOKEN_MARGIN_MS = 15_000;

// Statuses that make a command fall back to its newer variant.
const FALLBACK_STATUSES = [400, 403, 404];

const FAILED_STATUSES = ['failure', 'failed', 'error', 'rejected'];

function isExpiredTokenError(status, body) {
  if (status !== 401 && status !== 403) {
    return false;
  }
  const message = String(
    body && typeof body === 'object' ? (body.message ?? '') : (body ?? ''),
  ).toLowerCase();
  return (
    message.includes('expired') && (message.includes('token') || message.includes('signature'))
  );
}

/** Correlation id of an accepted asynchronous operation. */
export function correlationId(r, what) {
  const cid = r?.correlationId;
  const status = r?.responseStatus ?? r?.requestStatus;
  if (
    typeof cid !== 'string' ||
    !cid ||
    (typeof status === 'string' && FAILED_STATUSES.includes(status.toLowerCase()))
  ) {
    const reason = r?.debugMsg ?? r?.message ?? status ?? 'no correlation id in response';
    throw new UconnectCommandError(`${what} was not accepted: ${reason}`);
  }
  return cid;
}

export class UconnectApi {
  /**
   * @param {object} options
   * @param {object} options.brand - Brand configuration (brands.js).
   * @param {string} options.email
   * @param {string} options.password
   * @param {string} [options.pin] - PIN of the account, needed by commands.
   * @param {typeof fetch} [options.fetch] - Injected in tests.
   * @param {number} [options.timeoutMs]
   */
  constructor({ brand, email, password, pin, fetch = globalThis.fetch, timeoutMs = 30_000 }) {
    this.brand = brand;
    this.email = email;
    this.password = password;
    this.pin = pin || null;
    this.fetch = fetch;
    this.timeoutMs = timeoutMs;
    this.credentials = null;
    this.loginPromise = null;
    this.statusApiVersion = new Map();
    this.sdp = new Map();
    this.pinTokens = new Map();
  }

  get uid() {
    return this.credentials?.uid ?? null;
  }

  /** Log in (again) and cache the credentials. Concurrent calls share one login. */
  async login() {
    if (!this.loginPromise) {
      this.loginPromise = login({
        fetch: this.fetch,
        brand: this.brand,
        email: this.email,
        password: this.password,
        timeoutMs: this.timeoutMs,
      })
        .then((credentials) => {
          this.credentials = credentials;
          return credentials;
        })
        .finally(() => {
          this.loginPromise = null;
        });
    }
    return this.loginPromise;
  }

  async ensureCredentials() {
    if (this.credentials && !expiresSoon(this.credentials)) {
      return this.credentials;
    }
    return this.login();
  }

  /**
   * Send a signed request. `{uid}` in `path` is replaced with the account uid.
   * @returns {Promise<any>} The decoded JSON (null for an empty body).
   */
  async request(method, path, { endpoint, params, body, retry = true } = {}) {
    const creds = await this.ensureCredentials();
    const target = endpoint ?? this.brand.api;
    const url = new URL(path.replace('{uid}', creds.uid), target.url);
    for (const [k, v] of Object.entries(params ?? {})) {
      url.searchParams.set(k, String(v));
    }
    const data = body !== undefined ? JSON.stringify(body) : '';
    const headers = apiHeaders(this.brand, target.key);
    Object.assign(
      headers,
      sign(
        { method, url: url.toString(), headers, body: data },
        creds.aws,
        this.brand.region,
        'execute-api',
      ),
    );

    const res = await send(this.fetch, url.toString(), {
      method,
      headers,
      body: data || undefined,
      timeoutMs: this.timeoutMs,
    });
    const r = res.text ? parseJson(res.text) : null;

    if (retry && isExpiredTokenError(res.status, r ?? res.text)) {
      this.credentials = null;
      return this.request(method, path, { endpoint, params, body, retry: false });
    }
    if (res.status >= 400) {
      throw new UconnectApiError(`${method} ${url.pathname}: HTTP ${res.status}`, {
        status: res.status,
        body: r ?? res.text,
      });
    }
    if (res.text && r === null) {
      throw new UconnectApiError(`${method} ${url.pathname}: invalid JSON response`, {
        status: res.status,
      });
    }
    return r;
  }

  async requestObject(method, path, options) {
    const r = await this.request(method, path, options);
    if (r === null || r === undefined) {
      return {};
    }
    if (typeof r !== 'object' || Array.isArray(r)) {
      throw new UconnectApiError(`${method} ${path}: expected a JSON object`);
    }
    return r;
  }

  static vehiclePath(version, vin, suffix = '') {
    return `/${version}/accounts/{uid}/vehicles/${encodeURIComponent(vin)}/${suffix}`;
  }

  get(version, vin, suffix, options) {
    return this.requestObject('GET', UconnectApi.vehiclePath(version, vin, suffix), options);
  }

  post(version, vin, suffix, options) {
    return this.requestObject('POST', UconnectApi.vehiclePath(version, vin, suffix), options);
  }

  /** The vehicles of the account, with their services and a status snapshot. */
  async listVehicles() {
    const r = await this.requestObject('GET', '/v4/accounts/{uid}/vehicles/', {
      params: { stage: 'ALL', sdp: 'ALL', brand: this.brand.brandCode },
    });
    if (!Array.isArray(r.vehicles)) {
      throw new UconnectApiError('listVehicles: no vehicles in response');
    }
    for (const v of r.vehicles) {
      if (v?.vin && v?.sdp) {
        this.sdp.set(v.vin, v.sdp);
      }
    }
    return r.vehicles;
  }

  /**
   * Detailed status (`vehicleInfo`, `evInfo`). If the preferred endpoint
   * version is not supported by the vehicle the other one is tried, and the
   * working one is remembered.
   */
  async getVehicleInfo(vin, preferred) {
    const remembered = this.statusApiVersion.get(vin) ?? preferred;
    const versions = remembered
      ? [remembered, ...STATUS_API_VERSIONS.filter((v) => v !== remembered)]
      : [...STATUS_API_VERSIONS];
    for (let i = 0; i < versions.length; i += 1) {
      try {
        const r = await this.get(versions[i], vin, 'status/');
        this.statusApiVersion.set(vin, versions[i]);
        return r;
      } catch (err) {
        if (![400, 404, 502].includes(err.status) || i === versions.length - 1) {
          throw err;
        }
      }
    }
    throw new Error('unreachable');
  }

  /** Doors, windows, trunk, engine, climate... */
  getRemoteStatus(vin) {
    return this.get('v1', vin, 'remote/status/');
  }

  getLocation(vin) {
    return this.get('v1', vin, 'location/lastknown/');
  }

  /** URL of a rendered picture of the vehicle (`items[].preciseImageURL`). */
  getVehicleImage(vin, width = 600, height = 340) {
    return this.post('v4', vin, 'image/', {
      body: { imageURLs: [{ id: vin, width, height, resp: 'png' }] },
    });
  }

  getVehicleNotifications(vin) {
    return this.get('v1', vin, 'notifications/');
  }

  getRemoteOperationStatus(vin, cid) {
    return this.get('v1', vin, `remote/${encodeURIComponent(cid)}/status/`);
  }

  getRemoteOperationLastStatus(vin, cid) {
    return this.get('v1', vin, `remote/${encodeURIComponent(cid)}/last-status/`);
  }

  /**
   * Authenticate with the PIN: the token is required by every command. It is
   * cached per service delivery platform until it expires.
   */
  async pinAuth(vin) {
    if (!this.pin) {
      throw new UconnectPinError('a PIN is required to send commands');
    }
    const sdp = this.sdp.get(vin) ?? DEFAULT_SDP;
    const cached = this.pinTokens.get(sdp);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.token;
    }
    let r;
    try {
      r = await this.requestObject('POST', `/v1/accounts/{uid}/${sdp}/pin/authenticate/`, {
        endpoint: this.brand.mfa,
        body: { pin: Buffer.from(this.pin).toString('base64') },
      });
    } catch (err) {
      if (err.status >= 400 && err.status < 500) {
        throw new UconnectPinError(`PIN authentication failed: HTTP ${err.status}`);
      }
      throw err;
    }
    if (typeof r.token !== 'string' || !r.token) {
      throw new UconnectPinError('PIN authentication failed');
    }
    // The expiry is a lifetime in milliseconds.
    if (typeof r.expiry === 'number' && r.expiry > PIN_TOKEN_MARGIN_MS) {
      this.pinTokens.set(sdp, {
        token: r.token,
        expiresAt: Date.now() + r.expiry - PIN_TOKEN_MARGIN_MS,
      });
    }
    return r.token;
  }

  /**
   * Send a remote command, resolve its correlation id. A command refused with
   * HTTP 400/403/404 is retried with its newer variant when it has one.
   */
  async command(vin, apiCommand, params) {
    const pinAuth = await this.pinAuth(vin);
    let cmd = apiCommand;
    for (;;) {
      const body = { command: cmd.name, pinAuth };
      if (params !== undefined) {
        body.params = params;
      }
      try {
        const r = await this.post(cmd.apiVersion, vin, cmd.url, { body });
        return correlationId(r, `command ${cmd.name}`);
      } catch (err) {
        if (!FALLBACK_STATUSES.includes(err.status) || !cmd.fallback) {
          throw err;
        }
        cmd = cmd.fallback;
      }
    }
  }

  /** Send a destination to the navigation system, resolve the correlation id. */
  async sendDestination(vin, { latitude, longitude, name }) {
    const location = { latitude, longitude };
    if (name) {
      location.name = name;
    }
    const r = await this.post('v2', vin, 'sdv/location/', {
      body: { command: 'SDV', params: { location, routePreference: 'Fast' } },
    });
    return correlationId(r, 'send destination');
  }
}
