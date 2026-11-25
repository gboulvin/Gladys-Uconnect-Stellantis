// -----------------------------------------------------------------------------
// An in-memory Uconnect cloud: a `fetch` replacement answering the Gigya,
// token, Cognito and vehicle API endpoints the integration calls. Tests never
// touch the network. The state is mutable: a test changes `cloud.status[vin]`
// and the next refresh sees it.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), 'utf8'));

export const EV_VIN = 'ZFAEFAC39MX000001';
export const ICE_VIN = '1C4HJXEN5MW000002';
export const UID = 'uid0123456789';

const json = (status, body, headers = {}) =>
  new Response(body === undefined ? '' : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

export function createFakeCloud({ password = 'secret', pin = '1234' } = {}) {
  const cloud = {
    password,
    pin,
    calls: [],
    logins: 0,
    vehicles: fixture('vehicles'),
    status: { [EV_VIN]: fixture('status_ev'), [ICE_VIN]: fixture('status_ice') },
    remote: { [EV_VIN]: fixture('remote_status'), [ICE_VIN]: fixture('remote_status') },
    location: { [EV_VIN]: fixture('location'), [ICE_VIN]: null },
    // Result reported for every command: 'SUCCESS', 'FAILED' or null (pending).
    operationStatus: 'SUCCESS',
    // HTTP status forced on the command endpoint of a command name.
    commandHttpStatus: {},
    commands: [],
    down: false,
  };

  cloud.fetch = async (url, init = {}) => {
    const u = new URL(url);
    const method = init.method ?? 'GET';
    const body = init.body ? String(init.body) : '';
    cloud.calls.push({ method, host: u.host, path: u.pathname, headers: init.headers ?? {}, body });
    if (cloud.down) {
      throw new TypeError('fetch failed');
    }

    // --- Gigya ---------------------------------------------------------------
    if (u.pathname === '/accounts.webSdkBootstrap') {
      return json(200, { statusCode: 200, errorCode: 0 }, { 'set-cookie': 'gmid=abc; Path=/' });
    }
    if (u.pathname === '/accounts.login') {
      const params = new URLSearchParams(body);
      if (params.get('password') !== cloud.password) {
        return json(200, { statusCode: 403, errorCode: 403042, errorMessage: 'Invalid LoginID' });
      }
      cloud.logins += 1;
      return json(200, {
        statusCode: 200,
        errorCode: 0,
        UID: UID,
        sessionInfo: { login_token: 'login-token' },
      });
    }
    if (u.pathname === '/accounts.getJWT') {
      return json(200, { statusCode: 200, errorCode: 0, id_token: 'jwt' });
    }
    // --- Token exchange and Cognito -----------------------------------------
    if (u.pathname === '/v2/cognito/identity/token') {
      return json(200, { IdentityId: 'eu-west-1:identity', Token: 'openid-token' });
    }
    if (u.host.startsWith('cognito-identity.')) {
      return json(200, {
        Credentials: {
          AccessKeyId: 'AKID',
          SecretKey: 'SECRET',
          SessionToken: 'SESSION',
          Expiration: Date.now() / 1000 + 3600,
        },
      });
    }
    // --- PIN ----------------------------------------------------------------
    const pinMatch = u.pathname.match(/^\/v1\/accounts\/[^/]+\/([^/]+)\/pin\/authenticate\/$/);
    if (pinMatch) {
      const sent = Buffer.from(JSON.parse(body).pin, 'base64').toString();
      if (sent !== cloud.pin) {
        return json(403, { message: 'invalid pin' });
      }
      return json(200, { token: `pin-token-${pinMatch[1]}`, expiry: 300000 });
    }
    // --- Vehicle API ----------------------------------------------------------
    if (u.pathname === `/v4/accounts/${UID}/vehicles/`) {
      return json(200, cloud.vehicles);
    }
    const m = u.pathname.match(/^\/(v\d)\/accounts\/[^/]+\/vehicles\/([^/]+)\/(.*)$/);
    if (m) {
      const [, version, vin, rest] = m;
      if (rest === 'status/') {
        return version === 'v3' && cloud.status[vin] ? json(200, cloud.status[vin]) : json(404, {});
      }
      if (rest === 'remote/status/') {
        return cloud.remote[vin] ? json(200, cloud.remote[vin]) : json(404, {});
      }
      if (rest === 'location/lastknown/') {
        return cloud.location[vin] ? json(200, cloud.location[vin]) : json(404, {});
      }
      if (rest === 'image/') {
        return json(200, { items: [{ preciseImageURL: `https://images.example.com/${vin}.png` }] });
      }
      if (rest === 'notifications/') {
        return json(200, { notifications: { items: [] } });
      }
      if (/^remote\/[^/]+\/(last-)?status\/$/.test(rest)) {
        return cloud.operationStatus
          ? json(200, { status: cloud.operationStatus })
          : json(200, { status: 'PENDING' });
      }
      if (method === 'POST') {
        const payload = JSON.parse(body);
        const forced = cloud.commandHttpStatus[payload.command];
        if (forced) {
          return json(forced, { message: 'refused' });
        }
        cloud.commands.push({ vin, version, path: rest, ...payload });
        return json(200, {
          correlationId: `cid-${cloud.commands.length}`,
          responseStatus: 'pending',
        });
      }
    }
    return json(404, { message: `no route ${method} ${u.pathname}` });
  };
  return cloud;
}

/** A 1x1 PNG, for the vehicle picture downloads. */
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

export const imageFetch = async () =>
  new Response(TINY_PNG, { status: 200, headers: { 'content-type': 'image/png' } });
