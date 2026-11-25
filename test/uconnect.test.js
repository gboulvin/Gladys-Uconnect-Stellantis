// -----------------------------------------------------------------------------
// The Uconnect protocol layer (src/uconnect/), against the in-memory cloud.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sign } from '../src/uconnect/sigv4.js';
import { UconnectClient } from '../src/uconnect/client.js';
import { BRANDS, getBrand } from '../src/uconnect/brands.js';
import { resolveCommand, supportedCommands, VEHICLE_COMMANDS } from '../src/uconnect/commands.js';
import { UconnectAuthError, UconnectPinError } from '../src/uconnect/http.js';
import {
  allDoorsLocked,
  anyWindowOpen,
  isElectrified,
  timeToFullCharge,
} from '../src/uconnect/models.js';
import { createFakeCloud, EV_VIN, ICE_VIN } from './helpers/fake-cloud.js';

const noSleep = async () => {};

function client(cloud, overrides = {}) {
  return new UconnectClient({
    brand: 'fiat_eu',
    email: 'me@example.com',
    password: 'secret',
    pin: '1234',
    fetch: cloud.fetch,
    sleep: noSleep,
    ...overrides,
  });
}

test('SigV4 matches the AWS test suite (get-vanilla)', () => {
  const credentials = {
    accessKeyId: 'AKIDEXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
  };
  const now = new Date('2015-08-30T12:36:00Z');
  const vanilla = sign(
    { method: 'GET', url: 'https://example.amazonaws.com/', headers: {}, body: '' },
    credentials,
    'us-east-1',
    'service',
    now,
  );
  assert.equal(vanilla['X-Amz-Date'], '20150830T123600Z');
  assert.match(
    vanilla.Authorization,
    /SignedHeaders=host;x-amz-date, Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31$/,
  );
  // get-vanilla-query-order-key-case: the query is sorted before signing.
  const query = sign(
    {
      method: 'GET',
      url: 'https://example.amazonaws.com/?Param2=value2&Param1=value1',
      headers: {},
      body: '',
    },
    credentials,
    'us-east-1',
    'service',
    now,
  );
  assert.match(
    query.Authorization,
    /Signature=b97d918cfa904a5beff61c982a1b6f458b799221646efd99d3219ec94cdf2500$/,
  );
});

test('SigV4 signs the session token', () => {
  const headers = sign(
    { method: 'GET', url: 'https://example.amazonaws.com/', headers: {}, body: '' },
    { accessKeyId: 'A', secretAccessKey: 'S', sessionToken: 'TOKEN' },
    'eu-west-1',
    'execute-api',
  );
  assert.equal(headers['X-Amz-Security-Token'], 'TOKEN');
  assert.match(headers.Authorization, /SignedHeaders=host;x-amz-date;x-amz-security-token,/);
});

test('every brand has a complete configuration', () => {
  for (const [key, brand] of Object.entries(BRANDS)) {
    for (const field of [
      'label',
      'region',
      'loginApiKey',
      'loginUrl',
      'tokenUrl',
      'locale',
      'brandCode',
    ]) {
      assert.ok(brand[field], `${key}.${field}`);
    }
    assert.match(brand.loginUrl, /^https:\/\//, key);
    assert.match(brand.api.url, /^https:\/\//, key);
    assert.match(brand.mfa.url, /^https:\/\//, key);
  }
  assert.equal(getBrand('nope'), BRANDS.fiat_eu, 'an unknown key falls back to the default');
});

test('login: Gigya, token exchange, Cognito, then signed API calls', async () => {
  const cloud = createFakeCloud();
  const c = client(cloud);
  await c.refresh();
  assert.equal(cloud.logins, 1);
  const login = cloud.calls.find((call) => call.path === '/accounts.login');
  assert.equal(login.method, 'POST');
  assert.ok(login.body.includes('password=secret'), 'the password travels in the body');
  assert.equal(login.headers.Cookie, 'gmid=abc', 'the bootstrap cookie is sent back');
  const list = cloud.calls.find(
    (call) => call.path.endsWith('/vehicles/') && call.method === 'GET',
  );
  assert.match(list.headers.Authorization, /^AWS4-HMAC-SHA256 Credential=AKID\//);
  assert.equal(list.headers['x-api-key'], BRANDS.fiat_eu.api.key);
  assert.equal(list.headers['X-Amz-Security-Token'], 'SESSION');

  // The credentials are reused until they expire.
  await c.refresh();
  assert.equal(cloud.logins, 1);
});

test('a refused password is an authentication error', async () => {
  const cloud = createFakeCloud({ password: 'other' });
  await assert.rejects(client(cloud).refresh(), UconnectAuthError);
});

test('refresh parses an electric and a combustion vehicle', async () => {
  const cloud = createFakeCloud();
  const vehicles = await client(cloud).refresh();
  assert.equal(vehicles.size, 2);

  const ev = vehicles.get(EV_VIN);
  assert.equal(ev.nickname, '500e');
  assert.ok(isElectrified(ev));
  assert.equal(ev.stateOfCharge, 63);
  assert.equal(ev.charging, true);
  assert.equal(ev.pluggedIn, true);
  assert.equal(ev.distanceToEmpty, 134);
  assert.equal(ev.odometer, 1841);
  assert.equal(timeToFullCharge(ev), 96, 'the LEVEL_2 charger time');
  assert.equal(ev.tyres.front_left.pressure, 250);
  assert.equal(ev.tyres.rear_right.pressure, null);
  assert.equal(allDoorsLocked(ev), true, 'an NA door is ignored');
  assert.equal(anyWindowOpen(ev), false);
  assert.equal(ev.hvacOn, false);
  assert.deepEqual(ev.location.latitude, 45.0703);
  assert.ok(!ev.enabledServices.includes('ROHVACON'), 'a disabled service is not enabled');
  assert.ok(!ev.enabledServices.includes('REON'), 'a service the vehicle is not capable of');

  const ice = vehicles.get(ICE_VIN);
  assert.ok(!isElectrified(ice));
  assert.equal(ice.fuelAmount, 58);
  assert.equal(ice.distanceToEmpty, 312);
  assert.equal(ice.distanceToEmptyUnit, 'mi');
  assert.equal(ice.daysToService, -3);
  assert.equal(ice.location, null, 'no location endpoint: kept unknown');
  assert.ok(ice.enabledServices.includes('ROHVACON'), 'string booleans are understood');
});

test('commands resolve to the variant the vehicle supports', () => {
  const ev = ['RDL', 'RDU', 'CNOW2', 'DEEPREFRESH2', 'ROPRECOND', 'ROPRECOND_OFF', 'ROLIGHTS'];
  assert.equal(resolveCommand('charge_now', ev).name, 'START_CHARGE');
  assert.equal(resolveCommand('charge_now', ev).apiVersion, 'v4');
  assert.equal(resolveCommand('deep_refresh', ev).apiVersion, 'v2');
  assert.equal(resolveCommand('climate_on', ev).name, 'ROPRECOND', 'preconditioning stands in');
  assert.equal(resolveCommand('lights', ev).name, 'ROLIGHTS');
  assert.equal(resolveCommand('lights_horn', ev), null);
  assert.equal(resolveCommand('climate_on', ['ROHVACON']).name, 'ROHVACON');
  assert.equal(resolveCommand('nope', ev), null);
  assert.deepEqual(
    supportedCommands(ev),
    Object.keys(VEHICLE_COMMANDS).filter((k) => resolveCommand(k, ev)),
  );
});

test('a command authenticates the PIN on the vehicle platform and waits for the result', async () => {
  const cloud = createFakeCloud();
  const c = client(cloud);
  await c.refresh();
  const cid = await c.command(EV_VIN, 'lock');
  assert.deepEqual(cloud.commands.at(-1), {
    vin: EV_VIN,
    version: 'v1',
    path: 'remote/',
    command: 'RDL',
    pinAuth: 'pin-token-IGNITE',
  });
  assert.equal(await c.waitForOperation(EV_VIN, cid), true);

  cloud.operationStatus = 'FAILED';
  assert.equal(await c.waitForOperation(EV_VIN, cid), false);

  cloud.operationStatus = null;
  assert.equal(await c.waitForOperation(EV_VIN, cid, { timeoutMs: 0 }), null, 'no result');
});

test('the climate command carries the target temperature', async () => {
  const cloud = createFakeCloud();
  const c = client(cloud);
  await c.refresh();
  await c.command(ICE_VIN, 'climate_on', { temperature: 70, temperatureUnit: 'fahrenheit' });
  const sent = cloud.commands.at(-1);
  assert.equal(sent.command, 'ROHVACON');
  assert.equal(sent.version, 'v2');
  assert.equal(sent.params.targetTemp, 70);
  assert.equal(sent.params.temperatureUOM, 'Fahrenheit');
  assert.equal(sent.pinAuth, 'pin-token-SXM');
});

test('a refused command falls back to its newer variant', async () => {
  const cloud = createFakeCloud();
  cloud.vehicles.vehicles[0].services.push({
    service: 'DEEPREFRESH',
    serviceEnabled: true,
    vehicleCapable: true,
  });
  cloud.vehicles.vehicles[0].services = cloud.vehicles.vehicles[0].services.filter(
    (s) => s.service !== 'DEEPREFRESH2',
  );
  const c = client(cloud);
  await c.refresh();
  // The v1 DEEPREFRESH is refused: the v2 one is sent instead.
  const original = cloud.fetch;
  let refused = false;
  cloud.fetch = async (url, init) => {
    if (!refused && String(url).includes('/v1/') && String(url).endsWith('/ev/')) {
      refused = true;
      return new Response('{}', { status: 404 });
    }
    return original(url, init);
  };
  c.api.fetch = cloud.fetch;
  await c.command(EV_VIN, 'deep_refresh');
  assert.ok(refused);
  assert.equal(cloud.commands.at(-1).version, 'v2');
});

test('commands need a valid PIN', async () => {
  const missing = createFakeCloud();
  const noPin = client(missing, { pin: '' });
  await noPin.refresh();
  await assert.rejects(noPin.command(EV_VIN, 'lock'), UconnectPinError);

  const wrong = createFakeCloud({ pin: '9999' });
  const c = client(wrong);
  await c.refresh();
  await assert.rejects(c.command(EV_VIN, 'lock'), UconnectPinError);
});

test('the vehicle picture comes from the image endpoint', async () => {
  const cloud = createFakeCloud();
  const c = client(cloud);
  await c.refresh();
  assert.equal(await c.vehicleImageUrl(EV_VIN), `https://images.example.com/${EV_VIN}.png`);
});
