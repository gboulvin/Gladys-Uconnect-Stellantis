// -----------------------------------------------------------------------------
// The vehicle devices: discovery payload, published states, commands.
// The fake Gladys of the SDK refuses what the host API refuses (unknown
// category, missing min/max...): a bad feature fails here, not at the user's.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FEATURE, FEATURES, parseFeatureExternalId, vinOfDevice } from '../src/devices/vehicle.js';
import { deviceId, featureId, setup } from './helpers/setup.js';
import { EV_VIN, ICE_VIN } from './helpers/fake-cloud.js';

const featureKeys = (device) => device.features.map((f) => f.external_id.split(':').at(-1));

test('the first refresh publishes one device per vehicle', async () => {
  const { gladys } = await setup();
  const devices = gladys.fake.discoveredDevices;
  assert.equal(devices.length, 2);
  assert.deepEqual(
    devices.map((d) => [d.name, d.external_id]),
    [
      ['500e', deviceId(gladys, EV_VIN)],
      ['Wrangler', deviceId(gladys, ICE_VIN)],
    ],
  );
  assert.equal(gladys.fake.connectionStatus.connected, true);
});

test('every feature carries the columns Gladys stores NOT NULL', async () => {
  const { gladys } = await setup();
  for (const device of gladys.fake.discoveredDevices) {
    for (const feature of device.features) {
      for (const column of ['name', 'min', 'max', 'read_only', 'has_feedback']) {
        assert.notEqual(feature[column], undefined, `${feature.external_id}.${column}`);
        assert.notEqual(feature[column], null, `${feature.external_id}.${column}`);
      }
      assert.ok(feature.min <= feature.max, feature.external_id);
    }
  }
});

test('an electric vehicle gets its battery and charge features', async () => {
  const { gladys } = await setup();
  const ev = gladys.fake.discoveredDevices.find((d) => d.external_id === deviceId(gladys, EV_VIN));
  const keys = featureKeys(ev);
  for (const key of [
    FEATURE.BATTERY_LEVEL,
    FEATURE.CHARGING,
    FEATURE.PLUGGED,
    FEATURE.LOCK,
    FEATURE.CLIMATE,
  ]) {
    assert.ok(keys.includes(key), key);
  }
  assert.ok(!keys.includes(FEATURE.FUEL_LEVEL));
  assert.ok(!keys.includes(FEATURE.ENGINE), 'REON is not available on this vehicle');
  assert.ok(!keys.includes(FEATURE.TARGET_TEMPERATURE), 'no HVAC command, no target');
  const lock = ev.features.find((f) => f.external_id.endsWith(`:${FEATURE.LOCK}`));
  assert.equal(lock.read_only, false, 'the vehicle supports RDL and RDU');
  assert.equal(lock.has_feedback, true);
  const charging = ev.features.find((f) => f.external_id.endsWith(`:${FEATURE.CHARGING}`));
  assert.equal(charging.read_only, true);
  const odometer = ev.features.find((f) => f.external_id.endsWith(`:${FEATURE.ODOMETER}`));
  assert.equal(odometer.unit, 'km');
});

test('a combustion vehicle gets its fuel level, engine and units', async () => {
  const { gladys } = await setup();
  const ice = gladys.fake.discoveredDevices.find(
    (d) => d.external_id === deviceId(gladys, ICE_VIN),
  );
  const keys = featureKeys(ice);
  assert.ok(keys.includes(FEATURE.FUEL_LEVEL));
  assert.ok(keys.includes(FEATURE.ENGINE));
  assert.ok(keys.includes(FEATURE.TARGET_TEMPERATURE));
  assert.ok(keys.includes(FEATURE.LIGHTS_HORN));
  assert.ok(!keys.includes(FEATURE.BATTERY_LEVEL));
  const range = ice.features.find((f) => f.external_id.endsWith(`:${FEATURE.RANGE}`));
  assert.equal(range.unit, 'mile');
  const tyre = ice.features.find((f) => f.external_id.endsWith(`:${FEATURE.TYRE_FRONT_LEFT}`));
  assert.equal(tyre.unit, 'psi');
  assert.equal(tyre.max, 150);
});

test('the states of the vehicles are published', async () => {
  const { gladys } = await setup();
  const last = (vin, key) => gladys.fake.lastState(featureId(gladys, vin, key));
  assert.equal(last(EV_VIN, FEATURE.BATTERY_LEVEL), 63);
  assert.equal(last(EV_VIN, FEATURE.CHARGING), 1);
  assert.equal(last(EV_VIN, FEATURE.PLUGGED), 1);
  assert.equal(last(EV_VIN, FEATURE.LOCK), 1);
  assert.equal(last(EV_VIN, FEATURE.CHARGE_TIME), 96);
  assert.equal(last(EV_VIN, FEATURE.TYRE_FRONT_LEFT), 250);
  assert.equal(last(EV_VIN, FEATURE.TYRE_REAR_RIGHT), undefined, 'an unknown value is skipped');
  assert.equal(last(EV_VIN, FEATURE.BATTERY_12V), 14.88);
  assert.equal(last(ICE_VIN, FEATURE.FUEL_LEVEL), 58);
  assert.equal(last(ICE_VIN, FEATURE.DAYS_TO_SERVICE), -3);
  assert.equal(last(ICE_VIN, FEATURE.TARGET_TEMPERATURE), 21);
});

test('an unchanged refresh publishes no state again', async () => {
  const { gladys, service } = await setup();
  const before = gladys.fake.states.length;
  await service.refresh();
  assert.equal(gladys.fake.states.length, before);
});

test('every vehicle gets a cloud transport badge', async () => {
  const { gladys, cloud, service } = await setup();
  assert.deepEqual(
    gladys.fake.transports.map((t) => [t.device_external_id, t.transport, t.degraded ?? false]),
    [
      [deviceId(gladys, EV_VIN), 'cloud', false],
      [deviceId(gladys, ICE_VIN), 'cloud', false],
    ],
  );
  cloud.down = true;
  assert.equal(await service.refresh(), false);
  assert.equal(gladys.fake.transports.at(-1).degraded, true, 'stale values are flagged');
  assert.equal(gladys.fake.connectionStatus.connected, false);
});

test('a refused login stops the refreshes until the configuration changes', async () => {
  const { gladys, cloud, service } = await setup({ cloud: { password: 'other' } });
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.ok(gladys.fake.connectionStatus.message.de, 'the message is translated');
  const calls = cloud.calls.length;
  assert.equal(await service.refresh(), false);
  assert.equal(cloud.calls.length, calls, 'no new login attempt');
});

test('without credentials the integration asks for them', async () => {
  const { gladys } = await setup({ config: { email: '', password: '' } });
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.fr, /e-mail/);
});

test('locking a vehicle from Gladys sends the command, then publishes the state', async () => {
  const { gladys, cloud, service } = await setup();
  const lock = featureId(gladys, EV_VIN, FEATURE.LOCK);
  await service.setValue(lock, FEATURE.LOCK, EV_VIN, 0);
  await Promise.all(service.pendingCommands);
  assert.equal(cloud.commands.at(-1).command, 'RDU');
  assert.equal(gladys.fake.lastState(lock), 0);
});

test('the lights and horn feature is a one-shot action', async () => {
  const { gladys, cloud, service } = await setup();
  const horn = featureId(gladys, ICE_VIN, FEATURE.LIGHTS_HORN);
  await service.setValue(horn, FEATURE.LIGHTS_HORN, ICE_VIN, 1);
  await Promise.all(service.pendingCommands);
  assert.equal(cloud.commands.at(-1).command, 'HBLF');
  assert.equal(gladys.fake.lastState(horn), 0);
});

test('the target temperature is kept and sent with the next climate start', async () => {
  const { gladys, cloud, service } = await setup();
  const target = featureId(gladys, ICE_VIN, FEATURE.TARGET_TEMPERATURE);
  await service.setValue(target, FEATURE.TARGET_TEMPERATURE, ICE_VIN, 23);
  assert.equal(gladys.fake.lastState(target), 23);
  const climate = featureId(gladys, ICE_VIN, FEATURE.CLIMATE);
  await service.setValue(climate, FEATURE.CLIMATE, ICE_VIN, 1);
  await Promise.all(service.pendingCommands);
  assert.equal(cloud.commands.at(-1).command, 'ROHVACON');
  assert.equal(cloud.commands.at(-1).params.targetTemp, 23);
});

test('a command without PIN fails right away, with a translated message', async () => {
  const { gladys, service } = await setup({ config: { pin: '' } });
  const lock = featureId(gladys, EV_VIN, FEATURE.LOCK);
  await assert.rejects(service.setValue(lock, FEATURE.LOCK, EV_VIN, 1), (err) => {
    assert.match(err.userMessage.es, /PIN/);
    return true;
  });
});

test('Gladys command acks go through the SDK handler', async () => {
  const { gladys, service } = await setup();
  gladys.onSetValue(async (device, feature, value) => {
    const parsed = parseFeatureExternalId(gladys, feature.external_id);
    await service.setValue(feature.external_id, parsed.featureKey, parsed.vin, value);
  });
  const device = gladys.fake.discoveredDevices[0];
  const feature = device.features.find((f) => f.external_id.endsWith(`:${FEATURE.LOCK}`));
  const ack = await gladys.fake.setValue(device, feature, 1);
  assert.equal(ack.success, true);
  await Promise.all(service.pendingCommands);
});

test('external ids are parsed back to the VIN and the feature key', async () => {
  const { gladys } = await setup();
  for (const feature of FEATURES) {
    assert.deepEqual(parseFeatureExternalId(gladys, featureId(gladys, EV_VIN, feature.key)), {
      vin: EV_VIN,
      featureKey: feature.key,
    });
  }
  assert.equal(vinOfDevice(gladys, deviceId(gladys, ICE_VIN)), ICE_VIN);
  assert.equal(parseFeatureExternalId(gladys, 'ext:other:thing'), null);
});

test('feature keys are unique', () => {
  const keys = FEATURES.map((f) => f.key);
  assert.equal(new Set(keys).size, keys.length);
});
