// -----------------------------------------------------------------------------
// Scene triggers (fired on the transitions between two refreshes) and scene
// actions (send_command, refresh_vehicle, send_destination).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSceneActions } from '../src/scenes.js';
import { distanceMeters, TRIGGERS } from '../src/triggers.js';
import { deviceId, setup } from './helpers/setup.js';
import { EV_VIN, ICE_VIN } from './helpers/fake-cloud.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const declarationOf = (list, key) => manifest[list].find((entry) => entry.key === key);
const keysOf = (list) => (list ?? []).map((entry) => entry.key);

test('the first refresh fires no event: a restart is not a transition', async () => {
  const { gladys } = await setup();
  assert.deepEqual(gladys.fake.sceneEvents, []);
});

test('charging, plug, lock and ignition transitions fire one event each', async () => {
  const { gladys, cloud, service } = await setup();
  const battery = cloud.status[EV_VIN].evInfo.battery;
  battery.chargingStatus = 'IDLE';
  battery.plugInStatus = false;
  cloud.remote[EV_VIN] = structuredClone(cloud.remote[EV_VIN]);
  cloud.remote[EV_VIN].doors.driver.status = 'UNLOCKED';
  cloud.remote[EV_VIN].engine.status = 'ON';
  await service.refresh();

  const events = gladys.fake.sceneEvents;
  const byKey = Object.fromEntries(events.map((e) => [e.key, e.data]));
  assert.equal(byKey[TRIGGERS.CHARGING].state, 'stopped');
  assert.equal(byKey[TRIGGERS.CHARGING].battery_level, 63);
  assert.equal(byKey[TRIGGERS.PLUG].state, 'unplugged');
  assert.equal(byKey[TRIGGERS.LOCK].state, 'unlocked');
  assert.equal(byKey[TRIGGERS.IGNITION].state, 'on');
  for (const { data } of events) {
    assert.equal(data.device, deviceId(gladys, EV_VIN));
    assert.equal(data.vehicle, '500e');
  }

  // Nothing changed since: no new event.
  await service.refresh();
  assert.equal(gladys.fake.sceneEvents.length, events.length);
});

test('an unknown value in between does not hide a transition', async () => {
  const { gladys, cloud, service } = await setup();
  const battery = cloud.status[EV_VIN].evInfo.battery;
  delete battery.chargingStatus;
  await service.refresh();
  assert.equal(gladys.fake.sceneEvents.length, 0, 'charging -> unknown is not an event');
  battery.chargingStatus = 'IDLE';
  await service.refresh();
  assert.equal(gladys.fake.sceneEvents.at(-1).data.state, 'stopped');
});

test('battery_low fires when the charge crosses the threshold', async () => {
  const { gladys, cloud, service } = await setup({ config: { low_battery_threshold: 30 } });
  const battery = cloud.status[EV_VIN].evInfo.battery;
  battery.stateOfCharge = 35;
  await service.refresh();
  battery.stateOfCharge = 28;
  await service.refresh();
  battery.stateOfCharge = 25;
  await service.refresh();
  const low = gladys.fake.sceneEvents.filter((e) => e.key === TRIGGERS.BATTERY_LOW);
  assert.equal(low.length, 1, 'once, on the crossing');
  assert.deepEqual(low[0].data, {
    device: deviceId(gladys, EV_VIN),
    vehicle: '500e',
    battery_level: 28,
    threshold: 30,
  });
});

test('a new tyre warning and a move fire their events', async () => {
  const { gladys, cloud, service } = await setup();
  cloud.status[ICE_VIN].vehicleInfo.tyrePressure[2].warning = true;
  cloud.location[EV_VIN] = { latitude: 45.08, longitude: 7.6869, timeStamp: 1 };
  await service.refresh();
  const tyre = gladys.fake.sceneEvents.find((e) => e.key === TRIGGERS.TYRE_WARNING);
  assert.equal(tyre.data.wheel, 'rear_left');
  assert.equal(tyre.data.device, deviceId(gladys, ICE_VIN));
  const moved = gladys.fake.sceneEvents.find((e) => e.key === TRIGGERS.LOCATION);
  assert.equal(moved.data.latitude, 45.08);
  assert.ok(moved.data.distance > 1000 && moved.data.distance < 1100);
});

test('GPS noise is not a move', () => {
  const a = { latitude: 48.8566, longitude: 2.3522 };
  assert.ok(distanceMeters(a, { latitude: 48.8567, longitude: 2.3523 }) < 200);
  assert.ok(Math.abs(distanceMeters(a, { latitude: 45.764, longitude: 4.8357 }) - 391_500) < 2000);
});

test('scene events only carry the keys their trigger declares', async () => {
  const { gladys, cloud, service } = await setup();
  const battery = cloud.status[EV_VIN].evInfo.battery;
  battery.chargingStatus = 'IDLE';
  battery.plugInStatus = false;
  battery.stateOfCharge = 10;
  cloud.status[ICE_VIN].vehicleInfo.tyrePressure[0].warning = true;
  cloud.location[EV_VIN] = { latitude: 46, longitude: 7 };
  cloud.remote[ICE_VIN] = { ...structuredClone(cloud.remote[ICE_VIN]), engine: { status: 'ON' } };
  await service.refresh();
  const fired = new Set(gladys.fake.sceneEvents.map((e) => e.key));
  assert.ok(fired.size >= 5);
  for (const { key, data } of gladys.fake.sceneEvents) {
    const trigger = declarationOf('scene_triggers', key);
    const declared = [...keysOf(trigger.fields), ...keysOf(trigger.variables)];
    for (const [k, v] of Object.entries(data)) {
      assert.ok(declared.includes(k), `${key}: data.${k} is not declared`);
      assert.ok(v === null || typeof v !== 'object', `${key}: data.${k} must be a primitive`);
    }
    const state = trigger.fields.find((f) => f.key === 'state');
    if (state) {
      assert.ok(
        state.options.some((o) => o.value === data.state),
        `${key}: ${data.state}`,
      );
    }
  }
});

test('send_command returns the declared outputs', async () => {
  const { gladys, cloud, service } = await setup();
  const actions = createSceneActions(service);
  const outputs = await actions.send_command({
    device: deviceId(gladys, ICE_VIN),
    command: 'climate_on',
    temperature: '22',
  });
  assert.deepEqual(outputs, { success: true, status: 'success' });
  assert.equal(cloud.commands.at(-1).params.targetTemp, 22);
  const declared = keysOf(declarationOf('scene_actions', 'send_command').outputs);
  for (const key of Object.keys(outputs)) {
    assert.ok(declared.includes(key), key);
  }
});

test('an unsupported or failed command is an output, not an error', async () => {
  const { gladys, cloud, service } = await setup();
  const actions = createSceneActions(service);
  const device = deviceId(gladys, EV_VIN);
  // The 500e flashes its lights but has no horn command.
  assert.deepEqual(await actions.send_command({ device, command: 'lights_horn' }), {
    success: false,
    status: 'unsupported',
  });
  cloud.operationStatus = 'FAILED';
  assert.deepEqual(await actions.send_command({ device, command: 'lock' }), {
    success: false,
    status: 'failed',
  });
});

test('refresh_vehicle returns the state of the vehicle', async () => {
  const { gladys, service } = await setup();
  const outputs = await createSceneActions(service).refresh_vehicle({
    device: deviceId(gladys, EV_VIN),
  });
  assert.deepEqual(outputs, {
    battery_level: 63,
    range: 134,
    odometer: 1841,
    locked: true,
    charging: true,
    plugged: true,
    latitude: 45.0703,
    longitude: 7.6869,
  });
  const declared = keysOf(declarationOf('scene_actions', 'refresh_vehicle').outputs);
  for (const key of Object.keys(outputs)) {
    assert.ok(declared.includes(key), key);
  }
});

test('send_destination posts the destination to the navigation', async () => {
  const { gladys, cloud, service } = await setup();
  const outputs = await createSceneActions(service).send_destination({
    device: deviceId(gladys, EV_VIN),
    latitude: 48.85,
    longitude: 2.35,
    name: 'Office',
  });
  assert.deepEqual(outputs, { success: true });
  const sent = cloud.commands.at(-1);
  assert.equal(sent.command, 'SDV');
  assert.deepEqual(sent.params.location, { latitude: 48.85, longitude: 2.35, name: 'Office' });
});

test('an unknown vehicle throws a translated error', async () => {
  const { service } = await setup();
  await assert.rejects(
    createSceneActions(service).send_command({ device: 'ext:x:vehicle:NOPE', command: 'lock' }),
    (err) => Boolean(err.userMessage?.de),
  );
});
