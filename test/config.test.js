import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, isConfigured, normalizeConfig } from '../src/config.js';
import { LANGUAGES, MESSAGES, COMMAND_LABELS, t } from '../src/i18n.js';
import { VEHICLE_COMMANDS } from '../src/uconnect/commands.js';
import { createActions } from '../src/actions.js';
import { setup } from './helpers/setup.js';
import { EV_VIN } from './helpers/fake-cloud.js';

test('normalizeConfig applies the defaults', () => {
  assert.deepEqual(normalizeConfig(), DEFAULT_CONFIG);
  assert.equal(isConfigured(normalizeConfig()), false);
});

test('normalizeConfig fixes the types and bounds of form values', () => {
  const config = normalizeConfig({
    brand: 'unknown',
    email: '  me@example.com ',
    refresh_interval: '1',
    low_battery_threshold: '150',
    temperature_unit: 'kelvin',
    climate_temperature: 'abc',
    wait_for_confirmation: false,
    password: 'x',
  });
  assert.equal(config.brand, 'fiat_eu');
  assert.equal(config.email, 'me@example.com');
  assert.equal(config.refresh_interval, 2, 'two minutes minimum');
  assert.equal(config.low_battery_threshold, 100);
  assert.equal(config.temperature_unit, 'celsius');
  assert.equal(config.climate_temperature, 21);
  assert.equal(config.wait_for_confirmation, false);
  assert.equal(isConfigured(config), true);
});

test('every message and command label exists in the four languages', () => {
  for (const [key, message] of Object.entries({ ...MESSAGES, ...COMMAND_LABELS })) {
    for (const lang of LANGUAGES) {
      assert.ok(message[lang], `${key}.${lang}`);
    }
  }
  assert.deepEqual(Object.keys(COMMAND_LABELS), Object.keys(VEHICLE_COMMANDS));
});

test('t() fills the placeholders per language', () => {
  const message = t('command_success', { vehicle: '500e', command: COMMAND_LABELS.lock });
  assert.equal(message.en, '500e: "Lock the doors" done.');
  assert.equal(message.fr, '500e : « Verrouiller les portes » effectué.');
  assert.equal(message.de, '500e: „Türen verriegeln“ ausgeführt.');
  assert.equal(message.es, '500e: «Bloquear las puertas» realizado.');
});

test('test_connection lists the vehicles of the account', async () => {
  const { service } = await setup();
  const message = await createActions(service).test_connection({});
  assert.equal(message.en, 'Connected: 2 vehicle(s) found (500e, Wrangler).');
});

test('test_connection reports a refused login in the user language', async () => {
  const { service } = await setup({ cloud: { password: 'other' } });
  await assert.rejects(createActions(service).test_connection({}), (err) => {
    assert.match(err.userMessage.fr, /Connexion refusée/);
    return true;
  });
});

test('the send_command action answers the result', async () => {
  const { gladys, service } = await setup();
  const message = await createActions(service).send_command({
    device: gladys.externalIds('vehicle', EV_VIN).device,
    command: 'lock',
  });
  assert.equal(message.en, '500e: "Lock the doors" done.');
});

test('the refresh action reads the cloud again', async () => {
  const { cloud, service } = await setup();
  const before = cloud.calls.length;
  const message = await createActions(service).refresh({});
  assert.equal(message.en, 'Vehicles refreshed.');
  assert.ok(cloud.calls.length > before);
});
